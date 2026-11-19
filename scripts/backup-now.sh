#!/usr/bin/env bash
# Starts the backup workflow in the private backups repo and waits for it to succeed.
# Needs GH_TOKEN with Actions read/write on that repo. Used by the deploy before any migration runs.
set -euo pipefail
# external name, kept for now: the backups repo has not been renamed
repo=danilalutsai/oopsproof-backups
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# the branch is named: the token may not read the repo's default branch
gh workflow run backup.yml -R "$repo" --ref main
# the new run appears after a moment; pick the first one created after we asked
for _ in $(seq 1 30); do
  id=$(gh run list -R "$repo" -w backup.yml -e workflow_dispatch -L 5 --json databaseId,createdAt \
    --jq "map(select(.createdAt >= \"$started\")) | last | .databaseId // empty")
  [ -n "$id" ] && break
  sleep 5
done
[ -n "${id:-}" ] || { echo "Backup run did not start" >&2; exit 1; }
gh run watch "$id" -R "$repo" --exit-status --interval 15
