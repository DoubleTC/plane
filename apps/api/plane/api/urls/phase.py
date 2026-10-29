# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views.phase import (
    PhaseListCreateAPIEndpoint,
    PhaseDetailAPIEndpoint,
    PhaseArchiveUnarchiveAPIEndpoint,
    PhaseCycleListCreateAPIEndpoint,
    PhaseCycleDetailAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/",
        PhaseListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="phases",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/",
        PhaseDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="phase-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/archive/",
        PhaseArchiveUnarchiveAPIEndpoint.as_view(http_method_names=["post", "delete"]),
        name="phase-archive-unarchive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/cycles/",
        PhaseCycleListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="phase-cycles",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/phases/<uuid:phase_id>/cycles/<uuid:cycle_id>/",
        PhaseCycleDetailAPIEndpoint.as_view(http_method_names=["delete"]),
        name="phase-cycle-detail",
    ),
]
