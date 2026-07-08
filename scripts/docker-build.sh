#!/usr/bin/env bash
# Build the drive image for GHCR.
# Usage: ./scripts/docker-build.sh [tag]

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

echo "Building ${FULL}:${TAG} ..."
docker build -t "${FULL}:${TAG}" .

if [[ "$TAG" != "latest" ]]; then
	docker tag "${FULL}:${TAG}" "${FULL}:latest"
	echo "Tagged ${FULL}:latest"
fi

echo "Done. Image: ${FULL}:${TAG}"
