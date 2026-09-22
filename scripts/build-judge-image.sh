#!/usr/bin/env bash
# Builds the judge sandbox image used by JUDGE_RUNTIME=docker (see server/judge.ts and
# docker/judge.Dockerfile). Run this once on your Docker-capable server before switching
# JUDGE_RUNTIME to 'docker', and again any time you change the Dockerfile.
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE_NAME="${JUDGE_IMAGE:-skillforge-judge:latest}"

echo "Building judge sandbox image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" -f docker/judge.Dockerfile .

echo ""
echo "✓ Built $IMAGE_NAME"
echo ""
echo "Next: run scripts/verify-docker-judge.sh to confirm the sandbox actually works"
echo "correctly on this machine before enabling it for real submissions."
