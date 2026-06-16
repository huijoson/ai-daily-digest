#!/bin/bash
# Runs the daily digest pipeline (fetch + summarize) once. Invoked by the
# launchd schedule at ~/Library/LaunchAgents/com.aidailydigest.daily.plist.
# Output is appended to logs/daily-digest.log so you can see when it ran.
set -u
PROJECT_DIR="/Users/yuhan/coding/idea_prj"
NODE_BIN_DIR="/Users/yuhan/.hermes/node/bin"

cd "$PROJECT_DIR" || exit 1
export PATH="$NODE_BIN_DIR:$PATH"
mkdir -p logs

{
  echo "=========================================="
  echo "Run at: $(date)"
  "$NODE_BIN_DIR/node" node_modules/tsx/dist/cli.mjs scripts/run-pipeline.ts
  echo ""
} >> logs/daily-digest.log 2>&1
