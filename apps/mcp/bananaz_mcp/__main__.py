# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Entry point: `bananaz-mcp http` (default) or `bananaz-mcp stdio`."""

from __future__ import annotations

import logging
import os
import sys

import uvicorn

# Importing upstream's entry module switches FastMCP's loggers to structured JSON.
from plane_mcp.__main__ import JSONFormatter, UserContextFilter

from bananaz_mcp.server import build_server, create_app

DEFAULT_PORT = 8211


def _json_uvicorn_logging() -> None:
    for name in ("uvicorn", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        for handler in uvicorn_logger.handlers[:]:
            uvicorn_logger.removeHandler(handler)
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(JSONFormatter())
        handler.addFilter(UserContextFilter())
        uvicorn_logger.addHandler(handler)


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "http"

    if mode == "stdio":
        for name in ("PLANE_API_KEY", "PLANE_WORKSPACE_SLUG"):
            if not os.getenv(name):
                raise SystemExit(f"{name} is not set")
        build_server().run()
        return

    if mode != "http":
        raise SystemExit(f"Unknown mode {mode!r}: use 'http' or 'stdio'")

    _json_uvicorn_logging()
    uvicorn.run(
        create_app(),
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", str(DEFAULT_PORT))),
        log_level="info",
        access_log=False,
    )


if __name__ == "__main__":
    main()
