#!/usr/bin/env bash
# ============================================================
#  Build & push all Plane (Cenhomes fork) images to registry
#  Registry : registry2.cenhomes.vn/doubletc/banana
#
#  Usage:
#     ./build-and-push.sh                 # build + push tag "latest"
#     TAG=v2.6.0 ./build-and-push.sh      # custom tag
#     ./build-and-push.sh v2.6.0          # custom tag (positional)
#     NO_PUSH=1 ./build-and-push.sh       # build only, don't push
#     NO_CACHE=1 ./build-and-push.sh      # build with --no-cache
#     ONLY="web admin" ./build-and-push.sh   # build a subset only
#     PLATFORM=linux/amd64 ./build-and-push.sh   # cross-build (needs buildx)
#
#  Env (build-time frontend config — defaults give relative paths
#  that work behind the bundled proxy on a single domain):
#     VITE_API_BASE_URL, VITE_LIVE_BASE_URL, VITE_SPACE_BASE_URL,
#     VITE_ADMIN_BASE_URL, VITE_WEB_BASE_URL  (usually leave empty)
# ============================================================
set -euo pipefail

# ---- Config -------------------------------------------------
REGISTRY="${REGISTRY:-registry2.cenhomes.vn/doubletc/banana}"
TAG="${TAG:-${1:-latest}}"
NO_PUSH="${NO_PUSH:-0}"
NO_CACHE="${NO_CACHE:-0}"
PLATFORM="${PLATFORM:-}"          # e.g. linux/amd64 — empty = native
ONLY="${ONLY:-}"                  # space-separated subset of names

# Resolve repo root (directory of this script)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Build-arg passthrough for the Vite frontends (empty -> relative paths)
VITE_API_BASE_URL="${VITE_API_BASE_URL:-}"
VITE_LIVE_BASE_URL="${VITE_LIVE_BASE_URL:-}"
VITE_SPACE_BASE_URL="${VITE_SPACE_BASE_URL:-}"
VITE_ADMIN_BASE_URL="${VITE_ADMIN_BASE_URL:-}"
VITE_WEB_BASE_URL="${VITE_WEB_BASE_URL:-}"

# ---- Image matrix : name | context | dockerfile -------------
IMAGES=(
  "backend|./apps/api|Dockerfile.api"
  "web|.|apps/web/Dockerfile.web"
  "space|.|apps/space/Dockerfile.space"
  "admin|.|apps/admin/Dockerfile.admin"
  "live|.|apps/live/Dockerfile.live"
  "proxy|./apps/proxy|Dockerfile.ce"
)

# ---- Helpers ------------------------------------------------
log()  { printf '\033[1;34m[build]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ ok  ]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[fail ]\033[0m %s\n' "$*" >&2; }

extra_args=()
[ "$NO_CACHE" = "1" ] && extra_args+=(--no-cache)

# Detect buildx (required for --platform / --push in one step)
USE_BUILDX=0
if docker buildx version >/dev/null 2>&1; then
  USE_BUILDX=1
fi

frontend_build_args() {
  # Only the frontend images consume these; harmless for others.
  echo \
    --build-arg "VITE_API_BASE_URL=${VITE_API_BASE_URL}" \
    --build-arg "VITE_LIVE_BASE_URL=${VITE_LIVE_BASE_URL}" \
    --build-arg "VITE_SPACE_BASE_URL=${VITE_SPACE_BASE_URL}" \
    --build-arg "VITE_ADMIN_BASE_URL=${VITE_ADMIN_BASE_URL}" \
    --build-arg "VITE_WEB_BASE_URL=${VITE_WEB_BASE_URL}"
}

build_one() {
  local name="$1" context="$2" dockerfile="$3"
  local image="${REGISTRY}/${name}:${TAG}"

  log "Building ${image}"
  log "  context=${context} dockerfile=${dockerfile} platform=${PLATFORM:-native}"

  local fe_args=()
  case "$name" in
    web|space|admin) read -r -a fe_args <<<"$(frontend_build_args)";;
  esac

  if [ "$USE_BUILDX" = "1" ] && { [ -n "$PLATFORM" ] || [ "$NO_PUSH" != "1" ]; }; then
    # buildx path: builds and (optionally) pushes in a single step
    local push_flag="--load"
    [ "$NO_PUSH" != "1" ] && push_flag="--push"
    [ -n "$PLATFORM" ] && [ "$NO_PUSH" = "1" ] && push_flag="--load"  # --load is single-arch only

    docker buildx build \
      ${PLATFORM:+--platform "$PLATFORM"} \
      "${extra_args[@]}" \
      "${fe_args[@]}" \
      --build-arg DOCKER_BUILDKIT=1 \
      -f "${context}/${dockerfile}" \
      -t "$image" \
      $push_flag \
      "$context"
    ok "Built${push_flag:+ + pushed} ${image}"
  else
    # classic docker build, then push separately
    DOCKER_BUILDKIT=1 docker build \
      "${extra_args[@]}" \
      "${fe_args[@]}" \
      --build-arg DOCKER_BUILDKIT=1 \
      -f "${context}/${dockerfile}" \
      -t "$image" \
      "$context"
    ok "Built ${image}"
    if [ "$NO_PUSH" != "1" ]; then
      log "Pushing ${image}"
      docker push "$image"
      ok "Pushed ${image}"
    fi
  fi
}

# ---- Main ---------------------------------------------------
log "Registry : ${REGISTRY}"
log "Tag      : ${TAG}"
log "Push     : $([ "$NO_PUSH" = 1 ] && echo no || echo yes)"
log "buildx   : $([ "$USE_BUILDX" = 1 ] && echo yes || echo no)"
[ -n "$ONLY" ] && log "Subset   : ${ONLY}"
echo

built=()
for entry in "${IMAGES[@]}"; do
  IFS='|' read -r name context dockerfile <<<"$entry"
  if [ -n "$ONLY" ] && [[ " $ONLY " != *" $name "* ]]; then
    continue
  fi
  build_one "$name" "$context" "$dockerfile"
  built+=("${REGISTRY}/${name}:${TAG}")
  echo
done

ok "All done. Images:"
for img in "${built[@]}"; do printf '   - %s\n' "$img"; done
