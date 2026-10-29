# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date

import pytest
from rest_framework import status

from plane.db.models import (
    APIToken,
    Cycle,
    CycleIssue,
    Issue,
    Phase,
    PhaseCycle,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Phase Project",
        identifier="PHP",
        workspace=workspace,
        created_by=create_user,
        cycle_view=True,
        phase_view=True,
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def other_project(db, workspace, create_user):
    project = Project.objects.create(
        name="Other Project",
        identifier="OTH",
        workspace=workspace,
        created_by=create_user,
        cycle_view=True,
        phase_view=True,
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def cycles(db, project, create_user):
    return [
        Cycle.objects.create(name=f"Sprint {i}", project=project, workspace=project.workspace, owned_by=create_user)
        for i in (1, 2)
    ]


@pytest.fixture
def phase(db, project):
    return Phase.objects.create(
        name="Discovery",
        project=project,
        workspace=project.workspace,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
    )


def phases_url(slug, project_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/phases/"


def phase_url(slug, project_id, phase_id, suffix=""):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/phases/{phase_id}/{suffix}"


@pytest.mark.contract
class TestPhaseFeatureFlag:
    @pytest.mark.django_db
    def test_endpoints_require_phases_enabled(self, api_key_client, workspace, project, phase):
        project.phase_view = False
        project.save(update_fields=["phase_view"])

        list_response = api_key_client.get(phases_url(workspace.slug, project.id))
        detail_response = api_key_client.get(phase_url(workspace.slug, project.id, phase.id))

        assert list_response.status_code == status.HTTP_403_FORBIDDEN
        assert list_response.data["error"] == "Phases are not enabled for this project."
        assert detail_response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
class TestPhaseListCreate:
    @pytest.mark.django_db
    def test_create_phase(self, api_key_client, workspace, project, create_user):
        response = api_key_client.post(
            phases_url(workspace.slug, project.id),
            {
                "name": "Build",
                "status": "in-progress",
                "start_date": "2026-02-01",
                "end_date": "2026-02-28",
                "lead": str(create_user.id),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Build"
        assert response.data["status"] == "in-progress"
        assert str(response.data["lead"]) == str(create_user.id)
        assert response.data["total_cycles"] == 0
        assert response.data["completed_cycles"] == 0
        assert response.data["cycle_ids"] == []
        assert Phase.objects.filter(project=project, name="Build").exists()

    @pytest.mark.django_db
    def test_create_rejects_start_after_end(self, api_key_client, workspace, project):
        response = api_key_client.post(
            phases_url(workspace.slug, project.id),
            {"name": "Backwards", "start_date": "2026-03-10", "end_date": "2026-03-01"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Start date cannot exceed end date" in str(response.data)

    @pytest.mark.django_db
    def test_create_rejects_overlapping_dates(self, api_key_client, workspace, project, phase):
        # Ends on the first day of the existing phase: ranges are inclusive, so they overlap.
        response = api_key_client.post(
            phases_url(workspace.slug, project.id),
            {"name": "Overlap", "start_date": "2025-12-15", "end_date": "2026-01-01"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists on the given dates" in str(response.data)

    @pytest.mark.django_db
    def test_create_allows_adjacent_dates(self, api_key_client, workspace, project, phase):
        response = api_key_client.post(
            phases_url(workspace.slug, project.id),
            {"name": "Next", "start_date": "2026-02-01", "end_date": "2026-02-10"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED

    @pytest.mark.django_db
    def test_archived_phases_do_not_block_dates(self, api_key_client, workspace, project, phase):
        phase.archived_at = phase.created_at
        phase.save(update_fields=["archived_at"])

        response = api_key_client.post(
            phases_url(workspace.slug, project.id),
            {"name": "Reuse window", "start_date": "2026-01-10", "end_date": "2026-01-20"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED

    @pytest.mark.django_db
    def test_create_rejects_duplicate_name(self, api_key_client, workspace, project, phase):
        response = api_key_client.post(phases_url(workspace.slug, project.id), {"name": "Discovery"}, format="json")

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data["id"] == str(phase.id)

    @pytest.mark.django_db
    def test_create_rejects_lead_outside_project(self, api_key_client, workspace, project):
        outsider = User.objects.create(email="outsider@example.com", username="outsider")
        WorkspaceMember.objects.create(workspace=workspace, member=outsider, role=15)

        response = api_key_client.post(
            phases_url(workspace.slug, project.id),
            {"name": "Led elsewhere", "lead": str(outsider.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "lead" in response.data

    @pytest.mark.django_db
    def test_list_excludes_archived_unless_requested(self, api_key_client, workspace, project, phase):
        archived = Phase.objects.create(name="Old", project=project, workspace=workspace, archived_at=phase.created_at)

        active = api_key_client.get(phases_url(workspace.slug, project.id))
        only_archived = api_key_client.get(phases_url(workspace.slug, project.id) + "?archived=true")

        assert active.status_code == status.HTTP_200_OK
        assert [str(p["id"]) for p in active.data["results"]] == [str(phase.id)]
        assert [str(p["id"]) for p in only_archived.data["results"]] == [str(archived.id)]

    @pytest.mark.django_db
    def test_list_reports_cycle_progress(self, api_key_client, workspace, project, phase, cycles, create_user):
        done_state = State.objects.create(name="Done", project=project, workspace=workspace, group="completed")
        issue = Issue.objects.create(name="Shipped", project=project, workspace=workspace, state=done_state)
        CycleIssue.objects.create(cycle=cycles[0], issue=issue, project=project, workspace=workspace)
        for cycle in cycles:
            PhaseCycle.objects.create(phase=phase, cycle=cycle, project=project, workspace=workspace)

        response = api_key_client.get(phases_url(workspace.slug, project.id))

        row = response.data["results"][0]
        assert row["total_cycles"] == 2
        assert row["completed_cycles"] == 1
        assert sorted(str(c) for c in row["cycle_ids"]) == sorted(str(c.id) for c in cycles)


@pytest.mark.contract
class TestPhaseDetail:
    @pytest.mark.django_db
    def test_retrieve(self, api_key_client, workspace, project, phase):
        response = api_key_client.get(phase_url(workspace.slug, project.id, phase.id))

        assert response.status_code == status.HTTP_200_OK
        assert str(response.data["id"]) == str(phase.id)

    @pytest.mark.django_db
    def test_retrieve_from_another_project_is_not_found(self, api_key_client, workspace, other_project, phase):
        response = api_key_client.get(phase_url(workspace.slug, other_project.id, phase.id))

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_update_keeps_own_dates_valid(self, api_key_client, workspace, project, phase):
        response = api_key_client.patch(
            phase_url(workspace.slug, project.id, phase.id),
            {"name": "Discovery v2", "end_date": "2026-02-05"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Discovery v2"
        assert str(response.data["end_date"]) == "2026-02-05"

    @pytest.mark.django_db
    def test_update_rejects_overlap_with_another_phase(self, api_key_client, workspace, project, phase):
        later = Phase.objects.create(
            name="Later",
            project=project,
            workspace=workspace,
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 31),
        )

        response = api_key_client.patch(
            phase_url(workspace.slug, project.id, later.id), {"start_date": "2026-01-15"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        later.refresh_from_db()
        assert later.start_date == date(2026, 3, 1)

    @pytest.mark.django_db
    def test_delete(self, api_key_client, workspace, project, phase):
        response = api_key_client.delete(phase_url(workspace.slug, project.id, phase.id))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Phase.objects.filter(pk=phase.id).exists()
        assert api_key_client.get(phase_url(workspace.slug, project.id, phase.id)).status_code == 404

    @pytest.mark.django_db
    def test_archive_and_unarchive(self, api_key_client, workspace, project, phase):
        archived = api_key_client.post(phase_url(workspace.slug, project.id, phase.id, "archive/"))
        restored = api_key_client.delete(phase_url(workspace.slug, project.id, phase.id, "archive/"))

        assert archived.status_code == status.HTTP_200_OK
        assert archived.data["archived_at"] is not None
        assert restored.status_code == status.HTTP_200_OK
        assert restored.data["archived_at"] is None


@pytest.mark.contract
class TestPhaseCycles:
    @pytest.mark.django_db
    def test_add_list_and_remove_cycles(self, api_key_client, workspace, project, phase, cycles):
        url = phase_url(workspace.slug, project.id, phase.id, "cycles/")
        ids = [str(c.id) for c in cycles]

        added = api_key_client.post(url, {"cycles": ids}, format="json")
        assert added.status_code == status.HTTP_200_OK
        assert sorted(str(c["id"]) for c in added.data) == sorted(ids)

        # Re-adding an already linked cycle is a no-op, not a duplicate link.
        added_again = api_key_client.post(url, {"cycles": ids[:1]}, format="json")
        assert added_again.status_code == status.HTTP_200_OK
        assert PhaseCycle.objects.filter(phase=phase).count() == 2

        listed = api_key_client.get(url)
        assert sorted(str(c["id"]) for c in listed.data) == sorted(ids)

        removed = api_key_client.delete(phase_url(workspace.slug, project.id, phase.id, f"cycles/{ids[0]}/"))
        assert removed.status_code == status.HTTP_204_NO_CONTENT
        assert [str(c) for c in PhaseCycle.objects.filter(phase=phase).values_list("cycle_id", flat=True)] == [ids[1]]

        removed_again = api_key_client.delete(phase_url(workspace.slug, project.id, phase.id, f"cycles/{ids[0]}/"))
        assert removed_again.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_add_rejects_cycles_from_another_project(
        self, api_key_client, workspace, project, other_project, phase, cycles, create_user
    ):
        foreign = Cycle.objects.create(name="Foreign", project=other_project, workspace=workspace, owned_by=create_user)

        response = api_key_client.post(
            phase_url(workspace.slug, project.id, phase.id, "cycles/"),
            {"cycles": [str(cycles[0].id), str(foreign.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["cycle_ids"] == [str(foreign.id)]
        assert not PhaseCycle.objects.filter(phase=phase).exists()


@pytest.mark.contract
class TestPhasePermissions:
    @pytest.mark.django_db
    def test_guest_can_read_but_not_write(self, api_client, workspace, project, phase):
        guest = User.objects.create(email="guest@example.com", username="guest")
        WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5)
        ProjectMember.objects.create(project=project, member=guest, role=5, is_active=True)
        token = APIToken.objects.create(user=guest, label="guest", token="plane_api_guest_token_phase")
        api_client.credentials(HTTP_X_API_KEY=token.token)

        read = api_client.get(phases_url(workspace.slug, project.id))
        write = api_client.post(phases_url(workspace.slug, project.id), {"name": "Nope"}, format="json")

        assert read.status_code == status.HTTP_200_OK
        assert write.status_code == status.HTTP_403_FORBIDDEN
