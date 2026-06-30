#!/bin/bash
# Double-click to start QuizletLocal. The server runs in the background, so you
# can close this window and keep studying. To stop it, double-click
# "Stop QuizletLocal".
cd "$(dirname "$0")" || exit 1

# --- find a usable Node, even when launched outside a terminal -------------
NODE="$(command -v node 2>/dev/null)"
if [ -z "$NODE" ]; then
  for c in /opt/homebrew/bin/node /usr/local/bin/node "$HOME/.nvm/versions/node"/*/bin/node; do
    [ -x "$c" ] && NODE="$c" && break
  done
fi
if [ -z "$NODE" ]; then
  echo "❌ Node.js not found. Install it from https://nodejs.org, then try again."
  read -n 1 -s -r -p "Press any key to close…"
  exit 1
fi
NPM="$(dirname "$NODE")/npm"

clear 2>/dev/null || true
printf '\n  ▶  Starting QuizletLocal…\n\n'

if curl -s -o /dev/null --max-time 2 http://localhost:4321/ 2>/dev/null; then
  printf '  ✅ It was already running.\n'
else
  if [ ! -d node_modules ]; then
    printf '  • Installing dependencies (first run only)…\n'
    "$NPM" install || { read -n 1 -s -r -p "Install failed. Press any key…"; exit 1; }
  fi
  if [ ! -f dist/index.html ]; then
    printf '  • Building the app (first run only)…\n'
    "$NPM" run build || { read -n 1 -s -r -p "Build failed. Press any key…"; exit 1; }
  fi
  printf '  • Launching the server…\n'
  nohup "$NODE" server.js > server.log 2>&1 &
  echo $! > .server.pid
  # wait (up to ~6s) for it to answer
  for _ in $(seq 1 30); do
    curl -s -o /dev/null --max-time 1 http://localhost:4321/ 2>/dev/null && break
    sleep 0.2
  done
fi

open http://localhost:4321

printf '\n  ✅ QuizletLocal is running →  http://localhost:4321\n'
printf '     You can close this window; the app keeps running.\n'
printf '     To stop it, double-click  “Stop QuizletLocal”.\n\n'
