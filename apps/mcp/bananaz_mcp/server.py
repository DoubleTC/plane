# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Build the BananaZ MCP server on top of plane-mcp-server's tools and middleware."""

from __future__ import annotations

import os

from fastmcp import FastMCP
from fastmcp.server.auth import TokenVerifier
from plane_mcp.middleware import CoerceArguments, PlaneLoggingMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from bananaz_mcp import phase
from bananaz_mcp.auth import CachedHeaderAuthProvider
from bananaz_mcp.compat import BananaZValidateActionArguments, patch_sdk_models, register_supported_tools

SERVER_NAME = "BananaZ"
MCP_PATH = "/mcp"
HEALTH_PATH = "/mcp/health"

INSTRUCTIONS = """
## BananaZ
You are connected to BananaZ, a self-hosted project management tool based on Plane Community
Edition. Work items, projects, cycles, modules, states, labels, intake, comments, links and
attachments work as in Plane.

- Work items always belong to a project: pass project_id when listing them. Find a work item
  by its identifier (e.g. "WEB-12") with `workitem retrieve_by_identifier`, or across the
  workspace with `workitem search`.
- Phases are a BananaZ feature: a phase groups cycles of one project into a dated stage. Use
  the `phase` tool. To see a phase's work items, call `phase list_cycles`, then
  `cycle list_workitems` for each cycle.
- PQL filtering is not available: list, then filter the results yourself.
- Not available on BananaZ: pages, milestones, work item types and properties (so no epics),
  work logs, templates, initiatives, releases, customers, collections and work item relations.
"""


def _env_flag(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes")


def build_server(auth: TokenVerifier | None = None) -> FastMCP:
    """The BananaZ tool surface. `auth` is None for stdio, where the API key comes from env."""
    patch_sdk_models()
    mcp = FastMCP(SERVER_NAME, instructions=INSTRUCTIONS, auth=auth)
    # Same middleware stack as upstream, with argument validation that knows BananaZ's surface.
    # Payload logging defaults to off: tool arguments carry work item content.
    mcp.add_middleware(PlaneLoggingMiddleware(include_payloads=_env_flag("LOG_PAYLOADS", False)))
    mcp.add_middleware(CoerceArguments())
    mcp.add_middleware(BananaZValidateActionArguments(extra_tools={phase.NAME: phase.accepted_arguments()}))
    register_supported_tools(mcp, extra=(phase,))
    return mcp


def build_http_server() -> FastMCP:
    """Server for the HTTP transport: personal access token + x-workspace-slug headers."""
    auth = CachedHeaderAuthProvider(
        required_scopes=["read", "write"],
        ttl_seconds=float(os.getenv("AUTH_CACHE_TTL_SECONDS", "60")),
    )
    mcp = build_server(auth=auth)

    @mcp.custom_route(HEALTH_PATH, methods=["GET"])
    async def health(_: Request) -> JSONResponse:
        return JSONResponse({"status": "ok"})

    return mcp


def create_app():
    """ASGI app serving MCP (streamable HTTP, stateless) at /mcp and a health check at /mcp/health."""
    return build_http_server().http_app(path=MCP_PATH, stateless_http=True)
