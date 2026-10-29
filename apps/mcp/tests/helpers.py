# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import asyncio
import json

from fastmcp import Client

API = "http://plane.test/api/v1/workspaces/acme"
PROJECT_ID = "11111111-1111-1111-1111-111111111111"
PROJECT_API = f"{API}/projects/{PROJECT_ID}"


async def _list_tools(server):
    async with Client(server) as client:
        return await client.list_tools()


async def _call(server, name, arguments):
    async with Client(server) as client:
        result = await client.call_tool(name, arguments, raise_on_error=False)
        return result.is_error, "\n".join(getattr(part, "text", "") for part in result.content)


def list_tools(server):
    return {tool.name: tool for tool in asyncio.run(_list_tools(server))}


def call(server, name, arguments=None):
    """Call a tool; returns (is_error, text, parsed JSON or None)."""
    is_error, text = asyncio.run(_call(server, name, arguments or {}))
    try:
        parsed = json.loads(text)
    except ValueError:
        parsed = None
    return is_error, text, parsed


def page(results):
    """A paginated response envelope as BananaZ's /api/v1 returns it."""
    return {
        "grouped_by": None,
        "sub_grouped_by": None,
        "total_count": len(results),
        "next_cursor": "",
        "prev_cursor": "",
        "next_page_results": False,
        "prev_page_results": False,
        "count": len(results),
        "total_pages": 1,
        "total_results": len(results),
        "extra_stats": None,
        "results": results,
    }


def action_values(tool):
    schema = tool.inputSchema.get("properties", {}).get("action", {})
    return schema.get("enum") or [option.get("const") for option in schema.get("anyOf", [])]
