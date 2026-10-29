# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status

from plane.db.models import (
    Cycle,
    CycleIssue,
    Issue,
    Phase,
    PhaseCycle,
    Project,
    ProjectMember,
    State,
    UserFavorite,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Phase Project",
        identifier="PHL",
        workspace=workspace,
        created_by=create_user,
        phase_view=True,
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


def _cycle_with_issues(project, owner, name, state_groups):
    cycle = Cycle.objects.create(name=name, project=project, workspace=project.workspace, owned_by=owner)
    for index, group in enumerate(state_groups):
        state = State.objects.create(
            name=f"{name} {group} {index}", project=project, workspace=project.workspace, group=group
        )
        issue = Issue.objects.create(
            name=f"{name} item {index}", project=project, workspace=project.workspace, state=state
        )
        CycleIssue.objects.create(cycle=cycle, issue=issue, project=project, workspace=project.workspace)
    return cycle


@pytest.mark.contract
class TestPhaseListApp:
    @pytest.mark.django_db
    def test_list_annotates_cycle_progress_and_favorite(self, session_client, workspace, project, create_user):
        phase = Phase.objects.create(name="Build", project=project, workspace=workspace)
        other = Phase.objects.create(name="Launch", project=project, workspace=workspace)
        done = _cycle_with_issues(project, create_user, "Done", ["completed", "completed"])
        mixed = _cycle_with_issues(project, create_user, "Mixed", ["completed", "started"])
        empty = _cycle_with_issues(project, create_user, "Empty", [])
        for cycle in (done, mixed, empty):
            PhaseCycle.objects.create(phase=phase, cycle=cycle, project=project, workspace=workspace)
        UserFavorite.objects.create(
            user=create_user, workspace=workspace, project=project, entity_type="phase", entity_identifier=phase.id
        )

        response = session_client.get(f"/api/workspaces/{workspace.slug}/projects/{project.id}/phases/")

        assert response.status_code == status.HTTP_200_OK
        by_id = {str(row["id"]): row for row in response.data}
        assert by_id[str(phase.id)]["total_cycles"] == 3
        # Only "Done" counts: "Mixed" has an unfinished item and "Empty" has none.
        assert by_id[str(phase.id)]["completed_cycles"] == 1
        assert by_id[str(phase.id)]["is_favorite"] is True
        assert by_id[str(other.id)]["total_cycles"] == 0
        assert by_id[str(other.id)]["completed_cycles"] == 0
        assert by_id[str(other.id)]["is_favorite"] is False
        # Favorites are listed first.
        assert str(response.data[0]["id"]) == str(phase.id)
