#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OCR_HEALTH_URL="http://127.0.0.1:8787/health"
OCR_STARTED=0
OCR_PID=""

cleanup() {
  if [[ "$OCR_STARTED" -eq 1 && -n "$OCR_PID" ]]; then
    kill "$OCR_PID" 2>/dev/null || true
    wait "$OCR_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"

if curl -fsS "$OCR_HEALTH_URL" >/dev/null 2>&1; then
  echo "OCR 服务已就绪，直接启动前端。"
else
  echo "启动 OCR 服务..."
  npm run ocr:server &
  OCR_PID=$!
  OCR_STARTED=1

  for _ in {1..60}; do
    if curl -fsS "$OCR_HEALTH_URL" >/dev/null 2>&1; then
      echo "OCR 服务已就绪。"
      break
    fi

    if ! kill -0 "$OCR_PID" 2>/dev/null; then
      wait "$OCR_PID"
      exit 1
    fi

    sleep 1
  done

  if ! curl -fsS "$OCR_HEALTH_URL" >/dev/null 2>&1; then
    echo "OCR 服务在 60 秒内没有就绪。请先检查 .venv-ocr 和 paddleocr 依赖。" >&2
    exit 1
  fi
fi

echo "启动前端..."
npm run dev
