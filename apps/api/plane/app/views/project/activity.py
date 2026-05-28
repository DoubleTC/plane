# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Q
from django.utils.decorators import method_decorator
from django.views.decorators.gzip import gzip_page

from rest_framework.response import Response
from rest_framework import status

from plane.app.permissions import ProjectEntityPermission, allow_permission, ROLE
from plane.app.serializers import IssueActivitySerializer
from plane.app.views.base import BaseAPIView
from plane.db.models import IssueActivity, User, WorkspaceProjectState


# Project fields we surface in the activity feed, mapped to the human-readable
# noun used in the generated comment ("updated the {label}").
PROJECT_ACTIVITY_FIELDS = {
    "name": "name",
    "project_status": "state",
    "priority": "priority",
    "start_date": "start date",
    "end_date": "due date",
    "project_lead": "lead",
}


def _resolve_project_field_values(field, old_raw, new_raw, workspace):
    """Turn raw stored values into human-readable display strings.

    `project_status` and `project_lead` hold UUIDs, so we resolve them to the
    state name / member display name. Everything else is rendered as-is.
    """
    if field == "project_status":
        ids = [v for v in (old_raw, new_raw) if v]
        names = {
            str(k): v
            for k, v in WorkspaceProjectState.objects.filter(id__in=ids, workspace=workspace).values_list("id", "name")
        }
        return names.get(str(old_raw)), names.get(str(new_raw))

    if field == "project_lead":
        ids = [v for v in (old_raw, new_raw) if v]
        names = {str(k): v for k, v in User.objects.filter(id__in=ids).values_list("id", "display_name")}
        return names.get(str(old_raw)), names.get(str(new_raw))

    to_str = lambda v: str(v) if v not in (None, "") else None
    return to_str(old_raw), to_str(new_raw)


def record_project_property_activity(project, old_data, request_data, actor, workspace):
    """Persist project property changes as activity rows.

    Plane only fires webhooks on project update (no DB audit), so the overview
    activity feed would never show project-level changes. We reuse IssueActivity
    with a NULL issue — the table is project-scoped via ProjectBaseModel and the
    project activity endpoint already filters by project_id, so these rows slot
    in alongside issue activity without a new model/migration.
    """
    activities = []
    for field, label in PROJECT_ACTIVITY_FIELDS.items():
        if field not in request_data:
            continue
        old_raw = old_data.get(field)
        new_raw = request_data.get(field)
        # Normalise for comparison: treat None / "" as equal, compare by string.
        if str(old_raw or "") == str(new_raw or ""):
            continue
        old_display, new_display = _resolve_project_field_values(field, old_raw, new_raw, workspace)
        # Comment follows Plane's client-append convention: a phrase ending in
        # "to" (client appends new_value) for sets/changes, or a complete
        # "cleared the …" phrase when the value was removed.
        comment = f"updated the {label} to" if new_display else f"cleared the {label}"
        activities.append(
            IssueActivity(
                issue=None,
                project=project,
                workspace=workspace,
                actor=actor,
                verb="updated",
                field=field,
                old_value=old_display,
                new_value=new_display,
                comment=comment,
            )
        )

    if activities:
        IssueActivity.objects.bulk_create(activities, batch_size=10)


class ProjectActivityEndpoint(BaseAPIView):
    """Project-scoped activity feed.

    Aggregates IssueActivity rows for all issues inside a project, ordered
    by `created_at` DESC. Skips comment / vote / reaction / draft entries
    (mirroring the per-issue activity endpoint) so the feed reflects
    meaningful state/property changes rather than chat noise.

    The endpoint accepts an optional `?limit=` query param (default 50,
    capped at 200) — the right-sidebar surface only renders a short
    recent list, so we don't need full pagination here.
    """

    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    @method_decorator(gzip_page)
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        try:
            limit = int(request.GET.get("limit", 50))
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, 200))

        activities = (
            IssueActivity.objects.filter(
                workspace__slug=slug,
                project_id=project_id,
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .filter(~Q(field__in=["comment", "vote", "reaction", "draft"]))
            .select_related("actor", "workspace", "issue", "project")
            .order_by("-created_at")[:limit]
        )

        return Response(
            IssueActivitySerializer(activities, many=True).data,
            status=status.HTTP_200_OK,
        )
