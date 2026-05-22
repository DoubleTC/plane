# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models
from django.db.models import Q

# Module imports
from .project import ProjectBaseModel


class Milestone(ProjectBaseModel):
    name = models.CharField(max_length=255, verbose_name="Milestone Name")
    description = models.TextField(blank=True, verbose_name="Milestone Description")
    target_date = models.DateField(null=True, blank=True, verbose_name="Target Date")
    color = models.CharField(max_length=7, blank=True, null=True, verbose_name="Color")
    sort_order = models.FloatField(default=65535)
    logo_props = models.JSONField(default=dict)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ["name", "project", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "project"],
                condition=Q(deleted_at__isnull=True),
                name="milestone_unique_name_project_when_not_deleted",
            )
        ]
        verbose_name = "Milestone"
        verbose_name_plural = "Milestones"
        db_table = "milestones"
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        if self._state.adding:
            smallest_sort_order = Milestone.objects.filter(
                project=self.project
            ).aggregate(smallest=models.Min("sort_order"))["smallest"]
            if smallest_sort_order is not None:
                self.sort_order = smallest_sort_order - 10000
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} <{self.project.name}>"


class MilestoneIssue(ProjectBaseModel):
    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        related_name="issue_milestone",
    )
    milestone = models.ForeignKey(
        Milestone,
        on_delete=models.CASCADE,
        related_name="milestone_issues",
    )

    class Meta:
        unique_together = ["issue", "milestone", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["issue", "milestone"],
                condition=Q(deleted_at__isnull=True),
                name="milestone_issue_unique_when_not_deleted",
            )
        ]
        verbose_name = "Milestone Issue"
        verbose_name_plural = "Milestone Issues"
        db_table = "milestone_issues"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.milestone.name} <> {self.issue.name}"
