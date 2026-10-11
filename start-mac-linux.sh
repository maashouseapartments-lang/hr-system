#!/usr/bin/env bash
# تشغيل نظام الموارد البشرية على ماك أو لينكس
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js غير مثبت. ثبّت Node.js 22 من https://nodejs.org ثم أعد التشغيل."
  exit 1
fi
if ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"; then
  echo "إصدار Node.js قديم. ثبّت Node.js 22 أو أحدث من https://nodejs.org"
  exit 1
fi

[ -d node_modules ] || npm install || exit 1
[ -f .next/BUILD_ID ] || npm run build || exit 1

export HR_INSECURE_COOKIE=1
echo ""
echo "النظام يعمل على: http://localhost:3000"
echo "اترك هذه النافذة مفتوحة أثناء الاستخدام."
( sleep 4; (command -v open >/dev/null && open http://localhost:3000) || (command -v xdg-open >/dev/null && xdg-open http://localhost:3000) ) >/dev/null 2>&1 &
npm start
