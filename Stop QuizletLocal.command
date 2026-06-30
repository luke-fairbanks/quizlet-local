#!/bin/bash
# Double-click to stop the QuizletLocal server.
cd "$(dirname "$0")" || exit 1

clear 2>/dev/null || true
printf '\n  ■  Stopping QuizletLocal…\n\n'

stopped=0

# Preferred: the PID we recorded when starting.
if [ -f .server.pid ]; then
  PID="$(cat .server.pid 2>/dev/null)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null && stopped=1
  fi
  rm -f .server.pid
fi

# Fallback: whatever is LISTENING on port 4321 (not client connections, so we
# never touch the browser's connection to the app).
PORT_PIDS="$(lsof -ti tcp:4321 -sTCP:LISTEN 2>/dev/null)"
if [ -n "$PORT_PIDS" ]; then
  echo "$PORT_PIDS" | xargs kill 2>/dev/null && stopped=1
fi

if [ "$stopped" -eq 1 ]; then
  printf '  ✅ Stopped. You can close this window.\n\n'
else
  printf '  ℹ️  It wasn’t running. You can close this window.\n\n'
fi
