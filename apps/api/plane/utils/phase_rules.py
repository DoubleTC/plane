# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Business rules shared by the internal (session) and public (/api/v1) phase APIs."""

from datetime import date

from plane.db.models import Phase, ProjectMember

PHASE_DATES_OVERLAP_ERROR = "A phase already exists on the given dates. Please choose a different date range."
PHASE_DELETE_FORBIDDEN_ERROR = "Only a project admin or the phase creator can delete the phase."


def overlapping_phases(project_id, start_date: date, end_date: date, exclude_phase_id=None):
    """Active (non-archived, non-deleted) phases of the project whose inclusive date range
    overlaps [start_date, end_date].

    Phase dates are calendar dates (DateField), so they are compared as plain dates: no
    timezone conversion, otherwise adjacent ranges (Jan 1–31, Feb 1–28) collide in
    timezones ahead of UTC.
    """
    phases = Phase.objects.filter(
        project_id=project_id,
        archived_at__isnull=True,
        start_date__isnull=False,
        end_date__isnull=False,
        start_date__lte=end_date,
        end_date__gte=start_date,
    )
    if exclude_phase_id:
        phases = phases.exclude(pk=exclude_phase_id)
    return phases


def has_overlap(phase: Phase) -> bool:
    """Whether the phase's own dates collide with another active phase of its project."""
    if not (phase.start_date and phase.end_date):
        return False
    return overlapping_phases(phase.project_id, phase.start_date, phase.end_date, exclude_phase_id=phase.pk).exists()


def can_delete_phase(user, phase: Phase) -> bool:
    """Project admins and the phase creator may delete a phase (same rule as cycles)."""
    if phase.created_by_id == user.id:
        return True
    return ProjectMember.objects.filter(
        project_id=phase.project_id,
        member=user,
        role=20,
        is_active=True,
    ).exists()
