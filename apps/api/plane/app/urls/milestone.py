# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import MilestoneArchiveViewSet, MilestoneIssueViewSet, MilestoneViewSet

urlpatterns = [
    # Milestone CRUD
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/milestones/",
        MilestoneViewSet.as_view({"get": "list", "post": "create"}),
        name="project-milestones",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/milestones/<uuid:pk>/",
        MilestoneViewSet.as_view(
            {
                "get": "retrieve",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="project-milestone-detail",
    ),
    # Archive / Unarchive
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/milestones/<uuid:milestone_id>/archive/",
        MilestoneArchiveViewSet.as_view(),
        name="milestone-archive",
    ),
    # Milestone Issues (link / unlink)
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/milestones/<uuid:milestone_id>/milestone-issues/",
        MilestoneIssueViewSet.as_view({"get": "list", "post": "create"}),
        name="milestone-issues",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/milestones/<uuid:milestone_id>/milestone-issues/<uuid:pk>/",
        MilestoneIssueViewSet.as_view({"delete": "destroy"}),
        name="milestone-issue-detail",
    ),
]
