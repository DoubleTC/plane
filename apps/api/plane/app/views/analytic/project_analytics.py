# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.response import Response
from rest_framework import status
from typing import Dict, Any, Optional
from collections import defaultdict
from datetime import date, datetime, timedelta
from django.db.models import QuerySet, Q, Count
from django.http import HttpRequest
from django.db.models.functions import TruncMonth
from django.utils import timezone
from plane.app.views.base import BaseAPIView
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import (
    Project,
    Issue,
    Cycle,
    Module,
    CycleIssue,
    ModuleIssue,
    ProjectMember,
    State,
)
from django.db import models
from django.db.models import F, Case, When, Value
from django.db.models.functions import Concat
from plane.utils.build_chart import build_analytics_chart
from plane.utils.date_utils import (
    get_analytics_filters,
)


class ProjectAdvanceAnalyticsBaseView(BaseAPIView):
    def initialize_workspace(self, slug: str, type: str) -> None:
        self._workspace_slug = slug
        self.filters = get_analytics_filters(
            slug=slug,
            type=type,
            user=self.request.user,
            date_filter=self.request.GET.get("date_filter", None),
            project_ids=self.request.GET.get("project_ids", None),
        )


class ProjectAdvanceAnalyticsEndpoint(ProjectAdvanceAnalyticsBaseView):
    def get_filtered_counts(self, queryset: QuerySet) -> Dict[str, int]:
        def get_filtered_count() -> int:
            if self.filters["analytics_date_range"]:
                return queryset.filter(
                    created_at__gte=self.filters["analytics_date_range"]["current"]["gte"],
                    created_at__lte=self.filters["analytics_date_range"]["current"]["lte"],
                ).count()
            return queryset.count()

        return {
            "count": get_filtered_count(),
        }

    def get_work_items_stats(self, project_id, cycle_id=None, module_id=None) -> Dict[str, Dict[str, int]]:
        """
        Returns work item stats for the workspace, or filtered by cycle_id or module_id if provided.
        """
        base_queryset = None
        if cycle_id is not None:
            cycle_issues = CycleIssue.objects.filter(**self.filters["base_filters"], cycle_id=cycle_id).values_list(
                "issue_id", flat=True
            )
            base_queryset = Issue.issue_objects.filter(id__in=cycle_issues)
        elif module_id is not None:
            module_issues = ModuleIssue.objects.filter(**self.filters["base_filters"], module_id=module_id).values_list(
                "issue_id", flat=True
            )
            base_queryset = Issue.issue_objects.filter(id__in=module_issues)
        else:
            base_queryset = Issue.issue_objects.filter(**self.filters["base_filters"], project_id=project_id)

        return {
            "total_work_items": self.get_filtered_counts(base_queryset),
            "started_work_items": self.get_filtered_counts(base_queryset.filter(state__group="started")),
            "backlog_work_items": self.get_filtered_counts(base_queryset.filter(state__group="backlog")),
            "un_started_work_items": self.get_filtered_counts(base_queryset.filter(state__group="unstarted")),
            "completed_work_items": self.get_filtered_counts(base_queryset.filter(state__group="completed")),
        }

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def get(self, request: HttpRequest, slug: str, project_id: str) -> Response:
        self.initialize_workspace(slug, type="analytics")

        # Optionally accept cycle_id or module_id as query params
        cycle_id = request.GET.get("cycle_id", None)
        module_id = request.GET.get("module_id", None)
        return Response(
            self.get_work_items_stats(cycle_id=cycle_id, module_id=module_id, project_id=project_id),
            status=status.HTTP_200_OK,
        )


class ProjectAdvanceAnalyticsStatsEndpoint(ProjectAdvanceAnalyticsBaseView):
    def get_project_issues_stats(self) -> QuerySet:
        # Get the base queryset with workspace and project filters
        base_queryset = Issue.issue_objects.filter(**self.filters["base_filters"])

        # Apply date range filter if available
        if self.filters["chart_period_range"]:
            start_date, end_date = self.filters["chart_period_range"]
            base_queryset = base_queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)

        return (
            base_queryset.values("project_id", "project__name")
            .annotate(
                cancelled_work_items=Count("id", filter=Q(state__group="cancelled")),
                completed_work_items=Count("id", filter=Q(state__group="completed")),
                backlog_work_items=Count("id", filter=Q(state__group="backlog")),
                un_started_work_items=Count("id", filter=Q(state__group="unstarted")),
                started_work_items=Count("id", filter=Q(state__group="started")),
            )
            .order_by("project_id")
        )

    def get_work_items_stats(self, project_id, cycle_id=None, module_id=None) -> Dict[str, Dict[str, int]]:
        base_queryset = None
        if cycle_id is not None:
            cycle_issues = CycleIssue.objects.filter(**self.filters["base_filters"], cycle_id=cycle_id).values_list(
                "issue_id", flat=True
            )
            base_queryset = Issue.issue_objects.filter(id__in=cycle_issues)
        elif module_id is not None:
            module_issues = ModuleIssue.objects.filter(**self.filters["base_filters"], module_id=module_id).values_list(
                "issue_id", flat=True
            )
            base_queryset = Issue.issue_objects.filter(id__in=module_issues)
        else:
            base_queryset = Issue.issue_objects.filter(**self.filters["base_filters"], project_id=project_id)
        return (
            base_queryset.annotate(display_name=F("assignees__display_name"))
            .annotate(assignee_id=F("assignees__id"))
            .annotate(avatar=F("assignees__avatar"))
            .annotate(
                avatar_url=Case(
                    # If `avatar_asset` exists, use it to generate the asset URL
                    When(
                        assignees__avatar_asset__isnull=False,
                        then=Concat(
                            Value("/api/assets/v2/static/"),
                            "assignees__avatar_asset",  # Assuming avatar_asset has an id or relevant field
                            Value("/"),
                        ),
                    ),
                    # If `avatar_asset` is None, fall back to using `avatar` field directly
                    When(assignees__avatar_asset__isnull=True, then="assignees__avatar"),
                    default=Value(None),
                    output_field=models.CharField(),
                )
            )
            .values("display_name", "assignee_id", "avatar_url")
            .annotate(
                cancelled_work_items=Count("id", filter=Q(state__group="cancelled"), distinct=True),
                completed_work_items=Count("id", filter=Q(state__group="completed"), distinct=True),
                backlog_work_items=Count("id", filter=Q(state__group="backlog"), distinct=True),
                un_started_work_items=Count("id", filter=Q(state__group="unstarted"), distinct=True),
                started_work_items=Count("id", filter=Q(state__group="started"), distinct=True),
            )
            .order_by("display_name")
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def get(self, request: HttpRequest, slug: str, project_id: str) -> Response:
        self.initialize_workspace(slug, type="chart")
        type = request.GET.get("type", "work-items")

        if type == "work-items":
            # Optionally accept cycle_id or module_id as query params
            cycle_id = request.GET.get("cycle_id", None)
            module_id = request.GET.get("module_id", None)
            return Response(
                self.get_work_items_stats(project_id=project_id, cycle_id=cycle_id, module_id=module_id),
                status=status.HTTP_200_OK,
            )

        return Response({"message": "Invalid type"}, status=status.HTTP_400_BAD_REQUEST)


# Number of days a work item must finish ahead of its target date to count as
# "early" rather than merely "on-time". 0–1 day ahead is on-time; >=2 is early.
EARLY_THRESHOLD_DAYS = 2


def classify_timeliness(completed_at: Optional[datetime], target_date: Optional[date]) -> Optional[str]:
    """
    Classify a completed work item's timeliness relative to its target date.

    Returns one of "early" | "on_time" | "delayed", or None when either input is
    missing. ``diff`` is how many days *before* the deadline the item finished:
    negative means it finished late.
    """
    if completed_at is None or target_date is None:
        return None
    completed_date = completed_at.date() if hasattr(completed_at, "date") else completed_at
    diff = (target_date - completed_date).days
    if diff < 0:
        return "delayed"
    if diff >= EARLY_THRESHOLD_DAYS:
        return "early"
    return "on_time"


class ProjectAnalyticsOverviewEndpoint(ProjectAdvanceAnalyticsBaseView):
    """
    Aggregated per-project payload powering the Analytics → Projects BI tab.

    One round-trip returns everything the dashboard needs that isn't already
    available from the cycle/phase/module stores or the existing
    advance-analytics endpoint:

    - ``schedule``: project-level completion timeliness (early/on_time/delayed),
      computed only over completed work items that carry BOTH a start_date and a
      target_date (and a completed_at).
    - ``cycle_schedule`` / ``module_schedule``: the same buckets keyed by cycle
      and module id, so the frontend can rate each phase (= sum of its cycles),
      cycle and module.
    - ``state_breakdown``: every project state (stage) with its work-item count,
      including zero-count states.
    - ``members``: per project member — role / custom role, 30-day allocation %
      (this project vs. all the requesting user's workspace projects), completed
      vs. total assigned, on-time rate and the timeliness buckets used to rate
      individual performance.

    All aggregation is done with a handful of grouped queries (no per-member /
    per-cycle round-trips).
    """

    @staticmethod
    def _empty_buckets() -> Dict[str, int]:
        return {"early": 0, "on_time": 0, "delayed": 0}

    def _completed_dated_queryset(self, project_id: str) -> QuerySet:
        return Issue.issue_objects.filter(
            **self.filters["base_filters"],
            project_id=project_id,
            state__group="completed",
            start_date__isnull=False,
            target_date__isnull=False,
            completed_at__isnull=False,
        )

    def get_project_schedule(self, completed_dated: QuerySet) -> Dict[str, int]:
        buckets = self._empty_buckets()
        # No join here, so one row per issue — safe to count directly.
        for row in completed_dated.values("id", "completed_at", "target_date"):
            label = classify_timeliness(row["completed_at"], row["target_date"])
            if label:
                buckets[label] += 1
        return buckets

    def get_grouped_schedule(self, completed_dated: QuerySet, group_field: str) -> Dict[str, Dict[str, int]]:
        """Bucket completed-dated items by an arbitrary grouping column."""
        grouped: Dict[str, Dict[str, int]] = defaultdict(self._empty_buckets)
        for row in completed_dated.values(group_field, "completed_at", "target_date"):
            key = row[group_field]
            if not key:
                continue
            label = classify_timeliness(row["completed_at"], row["target_date"])
            if label:
                grouped[str(key)][label] += 1
        return grouped

    def get_state_breakdown(self, project_id: str) -> list:
        states = (
            State.objects.filter(project_id=project_id)
            .values("id", "name", "group", "color", "sequence")
            .order_by("sequence")
        )
        counts = (
            Issue.issue_objects.filter(**self.filters["base_filters"], project_id=project_id)
            .values("state_id")
            .annotate(count=Count("id", distinct=True))
        )
        count_map = {str(row["state_id"]): row["count"] for row in counts}
        return [
            {
                "id": str(state["id"]),
                "name": state["name"],
                "group": state["group"],
                "color": state["color"],
                "count": count_map.get(str(state["id"]), 0),
            }
            for state in states
        ]

    def get_members(self, project_id: str, member_schedule: Dict[str, Dict[str, int]]) -> list:
        # Per-member completed vs. total assigned within this project.
        member_totals = (
            Issue.issue_objects.filter(**self.filters["base_filters"], project_id=project_id)
            .values("assignees__id")
            .annotate(
                total=Count("id", distinct=True),
                completed=Count("id", filter=Q(state__group="completed"), distinct=True),
            )
        )
        totals_map = {
            str(row["assignees__id"]): row for row in member_totals if row["assignees__id"] is not None
        }

        # Allocation: distinct issues a member touched in the last 30 days, this
        # project vs. across all of the requesting user's workspace projects.
        cutoff = timezone.now() - timedelta(days=30)
        ws_alloc = (
            Issue.issue_objects.filter(**self.filters["base_filters"], updated_at__gte=cutoff)
            .values("assignees__id")
            .annotate(count=Count("id", distinct=True))
        )
        project_alloc = (
            Issue.issue_objects.filter(
                **self.filters["base_filters"], project_id=project_id, updated_at__gte=cutoff
            )
            .values("assignees__id")
            .annotate(count=Count("id", distinct=True))
        )
        ws_map = {str(r["assignees__id"]): r["count"] for r in ws_alloc if r["assignees__id"] is not None}
        project_map = {
            str(r["assignees__id"]): r["count"] for r in project_alloc if r["assignees__id"] is not None
        }

        members_qs = (
            ProjectMember.objects.filter(project_id=project_id, is_active=True, member__isnull=False)
            .select_related("member", "custom_role")
            .annotate(
                avatar_url=Case(
                    When(
                        member__avatar_asset__isnull=False,
                        then=Concat(
                            Value("/api/assets/v2/static/"),
                            "member__avatar_asset",
                            Value("/"),
                        ),
                    ),
                    When(member__avatar_asset__isnull=True, then="member__avatar"),
                    default=Value(None),
                    output_field=models.CharField(),
                )
            )
        )

        members = []
        for pm in members_qs:
            member_id = str(pm.member_id)
            schedule = member_schedule.get(member_id, self._empty_buckets())
            dated_total = schedule["early"] + schedule["on_time"] + schedule["delayed"]
            on_time_rate = (
                round((schedule["early"] + schedule["on_time"]) / dated_total * 100, 1) if dated_total else 0.0
            )
            ws_count = ws_map.get(member_id, 0)
            project_count = project_map.get(member_id, 0)
            allocation_pct = round(project_count / ws_count * 100, 1) if ws_count else 0.0
            totals = totals_map.get(member_id, {})
            members.append(
                {
                    "member_id": member_id,
                    "display_name": pm.member.display_name,
                    "avatar_url": pm.avatar_url,
                    "role": pm.role,
                    "custom_role": pm.custom_role.name if pm.custom_role else None,
                    "allocation_pct": allocation_pct,
                    "completed": totals.get("completed", 0),
                    "total_assigned": totals.get("total", 0),
                    "on_time_rate": on_time_rate,
                    "schedule": dict(schedule),
                }
            )
        # Heaviest allocation first so the table leads with the most-loaded members.
        members.sort(key=lambda m: m["allocation_pct"], reverse=True)
        return members

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def get(self, request: HttpRequest, slug: str, project_id: str) -> Response:
        self.initialize_workspace(slug, type="analytics")

        completed_dated = self._completed_dated_queryset(project_id)
        member_schedule = {
            key: dict(value)
            for key, value in self.get_grouped_schedule(completed_dated, "assignees__id").items()
        }

        return Response(
            {
                "schedule": self.get_project_schedule(completed_dated),
                "cycle_schedule": {
                    key: dict(value)
                    for key, value in self.get_grouped_schedule(completed_dated, "issue_cycle__cycle_id").items()
                },
                "module_schedule": {
                    key: dict(value)
                    for key, value in self.get_grouped_schedule(
                        completed_dated, "issue_module__module_id"
                    ).items()
                },
                "state_breakdown": self.get_state_breakdown(project_id),
                "members": self.get_members(project_id, member_schedule),
            },
            status=status.HTTP_200_OK,
        )


class ProjectAdvanceAnalyticsChartEndpoint(ProjectAdvanceAnalyticsBaseView):
    def work_item_completion_chart(self, project_id, cycle_id=None, module_id=None) -> Dict[str, Any]:
        # Get the base queryset
        queryset = (
            Issue.issue_objects.filter(**self.filters["base_filters"])
            .filter(project_id=project_id)
            .select_related("workspace", "state", "parent")
            .prefetch_related("assignees", "labels", "issue_module__module", "issue_cycle__cycle")
        )

        if cycle_id is not None:
            cycle_issues = CycleIssue.objects.filter(**self.filters["base_filters"], cycle_id=cycle_id).values_list(
                "issue_id", flat=True
            )
            cycle = Cycle.objects.filter(id=cycle_id).first()
            if cycle and cycle.start_date:
                start_date = cycle.start_date.date()
                end_date = cycle.end_date.date()
            else:
                return {"data": [], "schema": {}}
            queryset = cycle_issues

        elif module_id is not None:
            module_issues = ModuleIssue.objects.filter(**self.filters["base_filters"], module_id=module_id).values_list(
                "issue_id", flat=True
            )
            module = Module.objects.filter(id=module_id).first()
            if module and module.start_date:
                start_date = module.start_date
                end_date = module.target_date
            else:
                return {"data": [], "schema": {}}
            queryset = module_issues

        else:
            project = Project.objects.filter(id=project_id).first()
            if project.created_at:
                start_date = project.created_at.date().replace(day=1)
            else:
                return {"data": [], "schema": {}}

        if cycle_id or module_id:
            # Get daily stats with optimized query
            daily_stats = (
                queryset.values("created_at__date")
                .annotate(
                    created_count=Count("id"),
                    completed_count=Count("id", filter=Q(issue__state__group="completed")),
                )
                .order_by("created_at__date")
            )

            # Create a dictionary of existing stats with summed counts
            stats_dict = {
                stat["created_at__date"].strftime("%Y-%m-%d"): {
                    "created_count": stat["created_count"],
                    "completed_count": stat["completed_count"],
                }
                for stat in daily_stats
            }

            # Generate data for all days in the range
            data = []
            current_date = start_date
            while current_date <= end_date:
                date_str = current_date.strftime("%Y-%m-%d")
                stats = stats_dict.get(date_str, {"created_count": 0, "completed_count": 0})
                data.append(
                    {
                        "key": date_str,
                        "name": date_str,
                        "count": stats["created_count"] + stats["completed_count"],
                        "completed_issues": stats["completed_count"],
                        "created_issues": stats["created_count"],
                    }
                )
                current_date += timedelta(days=1)
        else:
            # Apply date range filter if available
            if self.filters["chart_period_range"]:
                start_date, end_date = self.filters["chart_period_range"]
                queryset = queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)

            # Annotate by month and count
            monthly_stats = (
                queryset.annotate(month=TruncMonth("created_at"))
                .values("month")
                .annotate(
                    created_count=Count("id"),
                    completed_count=Count("id", filter=Q(state__group="completed")),
                )
                .order_by("month")
            )

            # Create dictionary of month -> counts
            stats_dict = {
                stat["month"].strftime("%Y-%m-%d"): {
                    "created_count": stat["created_count"],
                    "completed_count": stat["completed_count"],
                }
                for stat in monthly_stats
            }

            # Generate monthly data (ensure months with 0 count are included)
            data = []
            # include the current date at the end
            end_date = timezone.now().date()
            last_month = end_date.replace(day=1)
            current_month = start_date

            while current_month <= last_month:
                date_str = current_month.strftime("%Y-%m-%d")
                stats = stats_dict.get(date_str, {"created_count": 0, "completed_count": 0})
                data.append(
                    {
                        "key": date_str,
                        "name": date_str,
                        "count": stats["created_count"],
                        "completed_issues": stats["completed_count"],
                        "created_issues": stats["created_count"],
                    }
                )
                # Move to next month
                if current_month.month == 12:
                    current_month = current_month.replace(year=current_month.year + 1, month=1)
                else:
                    current_month = current_month.replace(month=current_month.month + 1)

        schema = {
            "completed_issues": "completed_issues",
            "created_issues": "created_issues",
        }

        return {"data": data, "schema": schema}

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request: HttpRequest, slug: str, project_id: str) -> Response:
        self.initialize_workspace(slug, type="chart")
        type = request.GET.get("type", "projects")
        group_by = request.GET.get("group_by", None)
        x_axis = request.GET.get("x_axis", "PRIORITY")
        cycle_id = request.GET.get("cycle_id", None)
        module_id = request.GET.get("module_id", None)

        if type == "custom-work-items":
            queryset = (
                Issue.issue_objects.filter(**self.filters["base_filters"])
                .filter(project_id=project_id)
                .select_related("workspace", "state", "parent")
                .prefetch_related("assignees", "labels", "issue_module__module", "issue_cycle__cycle")
            )

            # Apply cycle/module filters if present
            if cycle_id is not None:
                cycle_issues = CycleIssue.objects.filter(**self.filters["base_filters"], cycle_id=cycle_id).values_list(
                    "issue_id", flat=True
                )
                queryset = queryset.filter(id__in=cycle_issues)

            elif module_id is not None:
                module_issues = ModuleIssue.objects.filter(
                    **self.filters["base_filters"], module_id=module_id
                ).values_list("issue_id", flat=True)
                queryset = queryset.filter(id__in=module_issues)

            # Apply date range filter if available
            if self.filters["chart_period_range"]:
                start_date, end_date = self.filters["chart_period_range"]
                queryset = queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)

            return Response(
                build_analytics_chart(queryset, x_axis, group_by),
                status=status.HTTP_200_OK,
            )

        elif type == "work-items":
            # Optionally accept cycle_id or module_id as query params
            cycle_id = request.GET.get("cycle_id", None)
            module_id = request.GET.get("module_id", None)

            return Response(
                self.work_item_completion_chart(project_id=project_id, cycle_id=cycle_id, module_id=module_id),
                status=status.HTTP_200_OK,
            )

        return Response({"message": "Invalid type"}, status=status.HTTP_400_BAD_REQUEST)
