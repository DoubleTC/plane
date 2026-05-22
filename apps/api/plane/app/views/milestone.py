# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import (
    Count,
    Exists,
    FloatField,
    OuterRef,
    Q,
    Subquery,
    Sum,
)
from django.db.models.functions import Cast
from django.utils import timezone

# Third-party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ProjectEntityPermission, ProjectLitePermission
from plane.app.serializers import (
    MilestoneIssueSerializer,
    MilestoneSerializer,
    MilestoneWriteSerializer,
)
from plane.db.models import Issue, Milestone, MilestoneIssue, Project

from . import BaseAPIView, BaseViewSet


class MilestoneViewSet(BaseViewSet):
    model = Milestone

    def get_serializer_class(self):
        if self.action in ["create", "partial_update", "update"]:
            return MilestoneWriteSerializer
        return MilestoneSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [ProjectLitePermission()]
        return [ProjectEntityPermission()]

    def get_queryset(self):
        # Issue count subqueries
        _filter = dict(
            issue_milestone__milestone_id=OuterRef("pk"),
            issue_milestone__deleted_at__isnull=True,
        )
        total_issues = (
            Issue.issue_objects.filter(**_filter)
            .values("issue_milestone__milestone_id")
            .annotate(cnt=Count("pk"))
            .values("cnt")
        )
        completed_issues = (
            Issue.issue_objects.filter(state__group="completed", **_filter)
            .values("issue_milestone__milestone_id")
            .annotate(cnt=Count("pk"))
            .values("cnt")
        )
        cancelled_issues = (
            Issue.issue_objects.filter(state__group="cancelled", **_filter)
            .values("issue_milestone__milestone_id")
            .annotate(cnt=Count("pk"))
            .values("cnt")
        )
        started_issues = (
            Issue.issue_objects.filter(state__group="started", **_filter)
            .values("issue_milestone__milestone_id")
            .annotate(cnt=Count("pk"))
            .values("cnt")
        )
        unstarted_issues = (
            Issue.issue_objects.filter(state__group="unstarted", **_filter)
            .values("issue_milestone__milestone_id")
            .annotate(cnt=Count("pk"))
            .values("cnt")
        )
        backlog_issues = (
            Issue.issue_objects.filter(state__group="backlog", **_filter)
            .values("issue_milestone__milestone_id")
            .annotate(cnt=Count("pk"))
            .values("cnt")
        )

        return (
            Milestone.objects.filter(
                workspace__slug=self.kwargs.get("slug"),
                project_id=self.kwargs.get("project_id"),
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .select_related("project", "workspace")
            .annotate(
                total_issues=Subquery(total_issues),
                completed_issues=Subquery(completed_issues),
                cancelled_issues=Subquery(cancelled_issues),
                started_issues=Subquery(started_issues),
                unstarted_issues=Subquery(unstarted_issues),
                backlog_issues=Subquery(backlog_issues),
            )
            .order_by("sort_order", "-created_at")
            .distinct()
        )

    def list(self, request, slug, project_id):
        # Check feature flag
        project = Project.objects.filter(
            workspace__slug=slug, pk=project_id
        ).first()
        if not project or not project.milestone_view:
            return Response(
                {"error": "Milestones are not enabled for this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = self.get_queryset().filter(archived_at__isnull=True)

        # Filter by state param
        milestone_view = request.GET.get("milestone_view", "all")
        now = timezone.now().date()
        if milestone_view == "upcoming":
            queryset = queryset.filter(
                Q(target_date__gt=now) | Q(target_date__isnull=True)
            )
        elif milestone_view == "overdue":
            queryset = queryset.filter(target_date__lt=now)
        elif milestone_view == "archived":
            queryset = self.get_queryset().filter(archived_at__isnull=False)

        serializer = MilestoneSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, slug, project_id):
        # Check feature flag
        project = Project.objects.filter(
            workspace__slug=slug, pk=project_id
        ).first()
        if not project or not project.milestone_view:
            return Response(
                {"error": "Milestones are not enabled for this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = MilestoneWriteSerializer(data=request.data)
        if serializer.is_valid():
            milestone = serializer.save(
                project_id=project_id,
                workspace=project.workspace,
                created_by=request.user,
                updated_by=request.user,
            )
            # Re-fetch with annotations
            milestone = self.get_queryset().get(pk=milestone.pk)
            return Response(
                MilestoneSerializer(milestone).data, status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, slug, project_id, pk):
        milestone = self.get_queryset().filter(pk=pk).first()
        if not milestone:
            return Response(
                {"error": "Milestone not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = MilestoneSerializer(milestone)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, slug, project_id, pk):
        milestone = Milestone.objects.filter(
            workspace__slug=slug, project_id=project_id, pk=pk
        ).first()
        if not milestone:
            return Response(
                {"error": "Milestone not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = MilestoneWriteSerializer(
            milestone, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            # Re-fetch with annotations
            milestone = self.get_queryset().get(pk=milestone.pk)
            return Response(
                MilestoneSerializer(milestone).data, status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, slug, project_id, pk):
        milestone = Milestone.objects.filter(
            workspace__slug=slug, project_id=project_id, pk=pk
        ).first()
        if not milestone:
            return Response(
                {"error": "Milestone not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        milestone.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MilestoneArchiveViewSet(BaseAPIView):
    """Archive/unarchive a milestone."""

    permission_classes = [ProjectEntityPermission]

    def post(self, request, slug, project_id, milestone_id):
        milestone = Milestone.objects.filter(
            workspace__slug=slug, project_id=project_id, pk=milestone_id
        ).first()
        if not milestone:
            return Response(
                {"error": "Milestone not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        milestone.archived_at = timezone.now()
        milestone.save(update_fields=["archived_at"])
        return Response({"archived_at": milestone.archived_at}, status=status.HTTP_200_OK)

    def delete(self, request, slug, project_id, milestone_id):
        milestone = Milestone.objects.filter(
            workspace__slug=slug, project_id=project_id, pk=milestone_id
        ).first()
        if not milestone:
            return Response(
                {"error": "Milestone not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        milestone.archived_at = None
        milestone.save(update_fields=["archived_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MilestoneIssueViewSet(BaseViewSet):
    """Add / list / remove issues from a milestone."""

    model = MilestoneIssue
    serializer_class = MilestoneIssueSerializer

    def get_permissions(self):
        if self.action == "list":
            return [ProjectLitePermission()]
        return [ProjectEntityPermission()]

    def get_queryset(self):
        return MilestoneIssue.objects.filter(
            workspace__slug=self.kwargs.get("slug"),
            project_id=self.kwargs.get("project_id"),
            milestone_id=self.kwargs.get("milestone_id"),
        ).select_related("milestone", "issue", "project", "workspace")

    def list(self, request, slug, project_id, milestone_id):
        queryset = self.get_queryset()
        serializer = MilestoneIssueSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, slug, project_id, milestone_id):
        """Add one or more issues to a milestone."""
        milestone = Milestone.objects.filter(
            workspace__slug=slug, project_id=project_id, pk=milestone_id
        ).first()
        if not milestone:
            return Response(
                {"error": "Milestone not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        issue_ids = request.data.get("issues", [])
        if not issue_ids:
            return Response(
                {"error": "No issues provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = milestone.project
        created_items = []
        for issue_id in issue_ids:
            issue = Issue.issue_objects.filter(
                workspace__slug=slug, project_id=project_id, pk=issue_id
            ).first()
            if not issue:
                continue
            # Skip if already linked
            if MilestoneIssue.objects.filter(
                milestone=milestone, issue=issue, deleted_at__isnull=True
            ).exists():
                continue
            mi = MilestoneIssue.objects.create(
                milestone=milestone,
                issue=issue,
                project=project,
                workspace=project.workspace,
                created_by=request.user,
                updated_by=request.user,
            )
            created_items.append(mi)

        serializer = MilestoneIssueSerializer(created_items, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, slug, project_id, milestone_id, pk):
        mi = MilestoneIssue.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            milestone_id=milestone_id,
            pk=pk,
        ).first()
        if not mi:
            return Response(
                {"error": "Milestone issue not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        mi.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
