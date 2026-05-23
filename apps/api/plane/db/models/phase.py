"""
Copyright (c) 2023-present Plane Software, Inc. and contributors
SPDX-License-Identifier: AGPL-3.0-only
See the LICENSE file for details.
"""

from django.conf import settings
from django.db import models

from plane.db.models.project import ProjectBaseModel

PHASE_STATUS = (
    ("backlog", "Backlog"),
    ("planned", "Planned"),
    ("in-progress", "In Progress"),
    ("paused", "Paused"),
    ("completed", "Completed"),
    ("cancelled", "Cancelled"),
)


class Phase(ProjectBaseModel):
    """
    A Phase groups one or more Cycles into a named time-box with a start
    and end date.  Progress is derived from the completion of linked cycles.
    """

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(choices=PHASE_STATUS, default="planned", max_length=20)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    lead = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="phase_leads",
        null=True,
        blank=True,
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="phase_members",
        through="PhaseMember",
        through_fields=("phase", "member"),
    )
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


class PhaseMember(ProjectBaseModel):
    """Members assigned to a Phase."""

    phase = models.ForeignKey(
        Phase,
        on_delete=models.CASCADE,
        related_name="phase_memberships",
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_phase_memberships",
    )

    class Meta:
        verbose_name = "Phase Member"
        verbose_name_plural = "Phase Members"
        db_table = "phase_members"
        unique_together = [["phase", "member", "deleted_at"]]
        constraints = [
            models.UniqueConstraint(
                fields=["phase", "member"],
                condition=models.Q(deleted_at__isnull=True),
                name="unique_phase_member_when_deleted_at_null",
            )
        ]

    def __str__(self):
        return f"Phase({self.phase_id}) — {self.member}"


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
