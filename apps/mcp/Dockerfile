# BananaZ MCP server: Plane's official MCP server fitted to BananaZ (Community Edition + Phases).
FROM python:3.12.5-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Pinned runtime dependencies first, so code changes reuse this layer.
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock

COPY pyproject.toml README.md ./
COPY bananaz_mcp ./bananaz_mcp
RUN pip install --no-cache-dir --no-deps . \
    && adduser -D -H -u 10001 mcp

USER mcp

EXPOSE 8211

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8211/mcp/health > /dev/null || exit 1

CMD ["bananaz-mcp", "http"]
