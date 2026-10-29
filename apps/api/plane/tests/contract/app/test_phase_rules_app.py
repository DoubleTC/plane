# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Cycle, Phase, PhaseCycle, Project, ProjectMember, User, WorkspaceMember


@pytest.fixture
def project(db, workspace, create_user):
    # BananaZ projects run in Vietnam (UTC+7): the timezone is what exposed the date-check bug.
    project = Project.objects.create(
        name="Phase Rules",
        identifier="PHR",
        workspace=workspace,
        created_by=create_user,
        phase_view=True,
        timezone="Asia/Ho_Chi_Minh",
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


def make_phase(project, creator, **fields):
    # BaseModel takes created_by from the request user; outside a request it must be passed explicitly.
    phase = Phase(project=project, workspace=project.workspace, **fields)
    phase.save(created_by_id=creator.id)
    return phase


@pytest.fixture
def january(db, project, create_user):
    return make_phase(project, create_user, name="January", start_date=date(2026, 1, 1), end_date=date(2026, 1, 31))


@pytest.fixture
def member(db, workspace, project):
    user = User.objects.create(email="member@example.com", username="member")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    ProjectMember.objects.create(project=project, member=user, role=15, is_active=True)
    return user


def phases_url(slug, project_id, suffix=""):
    return f"/api/workspaces/{slug}/projects/{project_id}/phases/{suffix}"


@pytest.mark.contract
class TestPhaseDateCheckApp:
    @pytest.mark.django_db
    def test_adjacent_range_is_free_in_a_utc_plus_timezone(self, session_client, workspace, project, january):
        response = session_client.post(
            phases_url(workspace.slug, project.id, "date-check/"),
            {"start_date": "2026-02-01", "end_date": "2026-02-28"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"status": True}

    @pytest.mark.django_db
    def test_overlapping_range_is_reported(self, session_client, workspace, project, january):
        response = session_client.post(
            phases_url(workspace.slug, project.id, "date-check/"),
            {"start_date": "2026-01-31", "end_date": "2026-02-10"},
            format="json",
        )

        assert response.data["status"] is False

    @pytest.mark.django_db
    def test_editing_a_phase_does_not_collide_with_itself(self, session_client, workspace, project, january):
        response = session_client.post(
            phases_url(workspace.slug, project.id, "date-check/"),
            {"start_date": "2026-01-01", "end_date": "2026-01-31", "phase_id": str(january.id)},
            format="json",
        )

        assert response.data == {"status": True}


@pytest.mark.contract
class TestPhaseWritesApp:
    @pytest.mark.django_db
    def test_create_rejects_overlapping_dates(self, session_client, workspace, project, january):
        response = session_client.post(
            phases_url(workspace.slug, project.id),
            {"name": "Overlap", "start_date": "2026-01-20", "end_date": "2026-02-10"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not Phase.objects.filter(name="Overlap").exists()

    @pytest.mark.django_db
    def test_unarchive_into_an_overlap_is_rejected(self, session_client, workspace, project, january):
        january.archived_at = timezone.now()
        january.save(update_fields=["archived_at"])
        Phase.objects.create(
            name="Mid January",
            project=project,
            workspace=workspace,
            start_date=date(2026, 1, 10),
            end_date=date(2026, 1, 20),
        )

        response = session_client.delete(phases_url(workspace.slug, project.id, f"{january.id}/archive/"))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        january.refresh_from_db()
        assert january.archived_at is not None

    @pytest.mark.django_db
    def test_member_who_did_not_create_the_phase_cannot_delete_it(
        self, api_client, workspace, project, january, member
    ):
        api_client.force_authenticate(user=member)

        response = api_client.delete(phases_url(workspace.slug, project.id, f"{january.id}/"))

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert Phase.objects.filter(pk=january.id).exists()

    @pytest.mark.django_db
    def test_creator_and_admin_can_delete(self, api_client, workspace, project, member, create_user):
        own = make_phase(project, member, name="Own")
        other = make_phase(project, member, name="Other")

        api_client.force_authenticate(user=member)
        assert api_client.delete(phases_url(workspace.slug, project.id, f"{own.id}/")).status_code == 204
        api_client.force_authenticate(user=create_user)  # project admin
        assert api_client.delete(phases_url(workspace.slug, project.id, f"{other.id}/")).status_code == 204


@pytest.mark.contract
class TestPhaseProgressApp:
    @pytest.mark.django_db
    def test_deleted_cycles_are_not_counted(self, session_client, workspace, project, january, create_user):
        kept = Cycle.objects.create(name="Kept", project=project, workspace=workspace, owned_by=create_user)
        removed = Cycle.objects.create(name="Removed", project=project, workspace=workspace, owned_by=create_user)
        for cycle in (kept, removed):
            PhaseCycle.objects.create(phase=january, cycle=cycle, project=project, workspace=workspace)
        # Deleting a cycle soft-deletes it at once; its phase links are cleaned up later in the background.
        removed.deleted_at = timezone.now()
        removed.save(update_fields=["deleted_at"])

        response = session_client.get(phases_url(workspace.slug, project.id))

        assert response.data[0]["total_cycles"] == 1
