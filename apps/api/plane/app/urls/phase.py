# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import PhaseViewSet, PhaseArchiveViewSet, PhaseCycleViewSet

urlpatterns = [
    # Phase CRUD
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/",
        PhaseViewSet.as_view({"get": "list", "post": "create"}),
        name="phase-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:pk>/",
        PhaseViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="phase-detail",
    ),
    # Archive / unarchive
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/archive/",
        PhaseArchiveViewSet.as_view({"post": "create", "delete": "destroy"}),
        name="phase-archive",
    ),
    # Phase ↔ Cycle linking
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/cycles/",
        PhaseCycleViewSet.as_view({"get": "list", "post": "create"}),
        name="phase-cycle-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/cycles/<uuid:pk>/",
        PhaseCycleViewSet.as_view({"delete": "destroy"}),
        name="phase-cycle-detail",
    ),
]
