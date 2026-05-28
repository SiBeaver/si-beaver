#!/usr/bin/env bash
# sync-to-public.sh — Mirror public si-beaver packages to the open-source repository.
#
# Usage:
#   ./scripts/sync-to-public.sh <target-repo-path> [--commit] [--push]
#
# Example:
#   ./scripts/sync-to-public.sh ../si-beaver-public --commit --push
#
# Only packages/{si-beaver-core,si-beaver-server,si-beaver-web}/ are synced.
# Enterprise code (si-beaver-cloud/, sibat-templates/) never leaves this private repo.

set -euo pipefail

TARGET="${1:-}"
COMMIT_FLAG=0
PUSH_FLAG=0

for arg in "$@"; do
  case "$arg" in
    --commit) COMMIT_FLAG=1 ;;
    --push)   PUSH_FLAG=1 ;;
  esac
done

if [ -z "$TARGET" ] || [ ! -d "$TARGET/.git" ]; then
  echo "Usage: $0 <target-repo-path> [--commit] [--push]"
  echo "  target-repo-path must be a git repo (the public si-beaver clone)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

RSYNC_EXCLUDE=(
  --exclude='dist/'
  --exclude='node_modules/'
  --exclude='.syncignore'
  --exclude='tests/'
)

# Sync public packages
for pkg in si-beaver-core si-beaver-server si-beaver-web; do
  SOURCE="$ROOT/packages/$pkg"
  DEST="$TARGET/packages/$pkg"
  mkdir -p "$DEST"

  echo "==> Syncing packages/$pkg -> $TARGET/packages/$pkg"

  EXCLUDE=("${RSYNC_EXCLUDE[@]}")
  if [ -f "$SOURCE/.syncignore" ]; then
    while IFS= read -r line; do
      [[ -z "$line" || "$line" =~ ^# ]] && continue
      EXCLUDE+=(--exclude="$line")
    done < "$SOURCE/.syncignore"
  fi

  rsync -avz --delete "${EXCLUDE[@]}" "$SOURCE/" "$DEST/"
done

# Sync root workspace config
echo "==> Syncing root config files"
rsync -avz "$ROOT/package.json" "$TARGET/"
rsync -avz "$ROOT/pnpm-workspace.yaml" "$TARGET/"
rsync -avz "$ROOT/pnpm-lock.yaml" "$TARGET/"

# Copy README if exists
if [ -f "$ROOT/README.md" ]; then
  rsync -avz "$ROOT/README.md" "$TARGET/"
fi

if [ "$COMMIT_FLAG" -eq 1 ]; then
  cd "$TARGET"
  if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    git add -A
    git commit -m "sync: mirror from ee repo $(date -u +%Y-%m-%d)"
    echo "==> Committed"
  else
    echo "==> Nothing to commit"
  fi

  if [ "$PUSH_FLAG" -eq 1 ]; then
    git push
    echo "==> Pushed"
  fi
fi

echo "==> Done"
