#!/usr/bin/env bash
# Запуск игрового сервера на macOS / Linux
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Не найден Node.js. Установите его с https://nodejs.org (версия 18 или новее)."
  exit 1
fi
[ -d node_modules ] || npm install || exit 1
npx vite build --logLevel warn || exit 1
( sleep 3; (open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null) ) &
npx tsx server/index.ts
