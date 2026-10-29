# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane_mcp.auth import PlaneHeaderAuthProvider
from starlette.testclient import TestClient

from bananaz_mcp.server import create_app

INITIALIZE = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "0"}},
}
MCP_HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


def test_health_needs_no_token():
    with TestClient(create_app()) as client:
        response = client.get("/mcp/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_mcp_requires_a_token():
    with TestClient(create_app()) as client:
        response = client.post("/mcp", json=INITIALIZE, headers=MCP_HEADERS)

    assert response.status_code == 401


def test_mcp_requires_the_workspace_header():
    with TestClient(create_app()) as client:
        response = client.post(
            "/mcp", json=INITIALIZE, headers={**MCP_HEADERS, "Authorization": "Bearer plane_api_token"}
        )

    # The token is never checked against BananaZ without x-workspace-slug.
    assert response.status_code == 401


def test_malformed_workspace_slug_is_rejected(monkeypatch):
    # The token itself is valid, so only the slug check can refuse the request.
    async def accept(self, token):
        return True

    monkeypatch.setattr(PlaneHeaderAuthProvider, "_validate_api_key", accept)

    with TestClient(create_app()) as client:
        bad = client.post(
            "/mcp",
            json=INITIALIZE,
            headers={**MCP_HEADERS, "Authorization": "Bearer plane_api_token", "x-workspace-slug": "../../auth"},
        )
        good = client.post(
            "/mcp",
            json=INITIALIZE,
            headers={**MCP_HEADERS, "Authorization": "Bearer plane_api_token", "x-workspace-slug": "acme"},
        )

    assert bad.status_code == 401
    assert good.status_code == 200
