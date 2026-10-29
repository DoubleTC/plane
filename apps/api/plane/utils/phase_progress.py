# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Count, Exists, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

from plane.db.models import CycleIssue, PhaseCycle


def annotate_phase_cycle_progress(queryset):
    """
    Annotate a Phase queryset with:
      - total_cycles    : number of linked cycles (links and cycles that were deleted are
                          ignored; deleting a cycle soft-deletes its links only later, in
                          a background task)
      - completed_cycles: number of linked cycles where EVERY work item has
                          state.group = 'completed' (cycles with zero work items
                          are NOT counted as complete)
    """
    cycle_has_any_issue = CycleIssue.objects.filter(
        cycle_id=OuterRef("cycle_id"),
        deleted_at__isnull=True,
    )
    cycle_has_incomplete_issue = CycleIssue.objects.filter(
        cycle_id=OuterRef("cycle_id"),
        deleted_at__isnull=True,
    ).exclude(issue__state__group="completed")

    # For a given Phase PK, count PhaseCycles whose linked cycle is "completed"
    # (has ≥1 work item AND no incomplete work items).
    completed_cycles_subq = Subquery(
        PhaseCycle.objects.filter(
            phase_id=OuterRef("pk"),
            deleted_at__isnull=True,
            cycle__deleted_at__isnull=True,
        )
        .annotate(
            has_any=Exists(cycle_has_any_issue),
            has_incomplete=Exists(cycle_has_incomplete_issue),
        )
        .filter(has_any=True, has_incomplete=False)
        .values("phase_id")
        .annotate(cnt=Count("id"))
        .values("cnt"),
        output_field=IntegerField(),
    )

    return queryset.annotate(
        total_cycles=Count(
            "phase_cycles",
            filter=Q(phase_cycles__deleted_at__isnull=True, phase_cycles__cycle__deleted_at__isnull=True),
            distinct=True,
        ),
        completed_cycles=Coalesce(completed_cycles_subq, 0),
    )
