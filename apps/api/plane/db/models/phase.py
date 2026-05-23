"""
Copyright (c) 2023-present Plane Software, Inc. and contributors
SPDX-License-Identifier: AGPL-3.0-only
See the LICENSE file for details.
"""

from django.db import models

from plane.db.models.project import ProjectBaseModel


class Phase(ProjectBaseModel):
    """
    A Phase groups one or more Cycles into a named time-box with a start
    and end date.  Progress is derived from the completion of linked cycles.
    """

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    sort_order = models.FloatField(default=65535)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Phase"
        verbose_name_plural = "Phases"
        db_table = "phases"
        ordering = ("sort_order",)
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                condition=models.Q(deleted_at__isnull=True),
                name="unique_phase_name_per_project",
            )
        ]

    def __str__(self):
        return f"{self.project} — {self.name}"


class PhaseCycle(ProjectBaseModel):
    """Bridge table linking a Phase to one or more Cycles."""

    phase = models.ForeignKey(
        Phase,
        on_delete=models.CASCADE,
        related_name="phase_cycles",
    )
    cycle = models.ForeignKey(
        "db.Cycle",
        on_delete=models.CASCADE,
        related_name="phase_cycles",
    )

    class Meta:
        verbose_name = "Phase Cycle"
        verbose_name_plural = "Phase Cycles"
        db_table = "phase_cycles"
        constraints = [
            models.UniqueConstraint(
                fields=["phase", "cycle"],
                condition=models.Q(deleted_at__isnull=True),
                name="unique_cycle_per_phase",
            )
        ]

    def __str__(self):
        return f"Phase({self.phase_id}) — Cycle({self.cycle_id})"
