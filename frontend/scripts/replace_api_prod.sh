#!/usr/bin/env sh
API_BASE="${VITE_BACKEND_URL:-}"
echo "replacing URLs with ${API_BASE:-same-origin}"
if [ -n "$API_BASE" ]; then
  find '/usr/share/nginx/html' -name '*.js' -exec sed -i -e 's,VITE_BACKEND_URL_RUNTIME_REPLACEMENT,'"$API_BASE"',g' {} \;
fi
echo "result: $?, now starting nginx"
nginx -g "daemon off;"
