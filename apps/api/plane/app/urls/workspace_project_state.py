# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from django.urls import path

from plane.app.views import WorkspaceProjectStateFeatureToggleEndpoint, WorkspaceProjectStateViewSet

urlpatterns = [
    path(
        "workspaces/<str:slug>/project-states/",
        WorkspaceProjectStateViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-project-states",
    ),
    path(
        "workspaces/<str:slug>/project-states/<uuid:pk>/",
        WorkspaceProjectStateViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-project-state-detail",
    ),
    path(
        "workspaces/<str:slug>/project-states/toggle/",
        WorkspaceProjectStateFeatureToggleEndpoint.as_view(),
        name="workspace-project-states-toggle",
    ),
]
