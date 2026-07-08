#!/usr/bin/env bash
# Push the drive image to private GHCR.
# Usage: GHCR_USER=you GHCR_TOKEN=ghp_... ./scripts/docker-push.sh [tag]

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$(dirname "$0")/docker-ghcr.env"
if [[ -f "$ENV_FILE" ]]; then
	set -a
	# shellcheck source=/dev/null
	source "$ENV_FILE"
	set +a
fi

TAG="${1:-latest}"
REGISTRY="${GHCR_REGISTRY:-ghcr.io}"
ORG="${GHCR_ORG:-punhlaingsoftwareengineering}"
IMAGE="${GHCR_IMAGE:-drive}"
FULL="${REGISTRY}/${ORG}/${IMAGE}"

if [[ -n "${GHCR_TOKEN:-}" && -n "${GHCR_USER:-}" ]]; then
	echo "Logging in to ${REGISTRY} as ${GHCR_USER} ..."
	echo "$GHCR_TOKEN" | docker login "$REGISTRY" -u "$GHCR_USER" --password-stdin
else
	echo "GHCR_TOKEN/GHCR_USER not set — using existing docker login session."
fi

echo "Pushing ${FULL}:${TAG} ..."
docker push "${FULL}:${TAG}"

if [[ "$TAG" != "latest" ]]; then
	if docker image inspect "${FULL}:latest" &>/dev/null; then
		echo "Pushing ${FULL}:latest ..."
		docker push "${FULL}:latest"
	fi
fi

echo "Pushed ${FULL}:${TAG}"
echo "Pull on server: docker pull ${FULL}:${TAG}"
