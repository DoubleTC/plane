# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status

from plane.db.models import Phase, Project, ProjectMember


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Phase Project",
        identifier="PHA",
        workspace=workspace,
        created_by=create_user,
        phase_view=True,
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def phase(db, project):
    return Phase.objects.create(name="Discovery", project=project, workspace=project.workspace)


def archive_url(slug, project_id, phase_id):
    return f"/api/workspaces/{slug}/projects/{project_id}/phases/{phase_id}/archive/"


@pytest.mark.contract
class TestPhaseArchiveApp:
    @pytest.mark.django_db
    def test_archive_sets_archived_at(self, session_client, workspace, project, phase):
        response = session_client.post(archive_url(workspace.slug, project.id, phase.id))

        assert response.status_code == status.HTTP_200_OK
        phase.refresh_from_db()
        assert phase.archived_at is not None
        assert response.data["archived_at"] == phase.archived_at

    @pytest.mark.django_db
    def test_unarchive_clears_archived_at(self, session_client, workspace, project, phase):
        session_client.post(archive_url(workspace.slug, project.id, phase.id))

        response = session_client.delete(archive_url(workspace.slug, project.id, phase.id))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        phase.refresh_from_db()
        assert phase.archived_at is None
