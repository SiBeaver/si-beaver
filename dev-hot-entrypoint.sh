#!/bin/sh
# dev-hot-entrypoint.sh — Pod 内 Node.js 热重载 wrapper
#
# Layout:
#   /app/node_modules  — 来自镜像 (npm ci --omit=dev)
#   /devhot/dist/      — 后端编译产物 (rsync 更新)
#   /devhot/web/dist/  — 前端静态文件 (rsync 更新)
#   /devhot/.reload    — 触发后端重启的信号文件
#   /devhot/.status    — 当前状态 (starting/ready/crashed)
set -u

DEVHOT="/devhot"
TRIGGER="$DEVHOT/.reload"
STATUS="$DEVHOT/.status"
PID=""

# 让 Node.js 模块解析找到镜像中的 node_modules
ln -sfn /app/node_modules "$DEVHOT/node_modules"

start() {
  echo "starting" > "$STATUS"
  echo "[dev-hot] $(date +%T) Starting node..."
  node "$DEVHOT/dist/api/server.js" &
  PID=$!
  sleep 1
  if kill -0 "$PID" 2>/dev/null; then
    echo "ready" > "$STATUS"
    echo "[dev-hot] $(date +%T) Ready (PID=$PID)"
  else
    echo "crashed" > "$STATUS"
    echo "[dev-hot] $(date +%T) Failed to start"
    PID=""
  fi
}

stop() {
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "[dev-hot] $(date +%T) Stopping node (PID=$PID)..."
    kill "$PID" 2>/dev/null
    wait "$PID" 2>/dev/null || true
  fi
  PID=""
}

trap 'stop; exit 0' SIGTERM SIGINT

rm -f "$TRIGGER"
start

while true; do
  if [ -f "$TRIGGER" ]; then
    rm -f "$TRIGGER"
    stop
    start
  fi
  if [ -n "$PID" ] && ! kill -0 "$PID" 2>/dev/null; then
    echo "crashed" > "$STATUS"
    echo "[dev-hot] $(date +%T) Node crashed. Waiting for .reload..."
    PID=""
  fi
  sleep 1
done
