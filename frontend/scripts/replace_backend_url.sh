#!/usr/bin/env sh
BACKEND_URL="${VITE_BACKEND_URL:-}"
echo "replacing backend URL with ${BACKEND_URL:-same-origin}"
find '/usr/share/nginx/html' -name '*.js' -exec sed -i -e 's,VITE_BACKEND_URL_RUNTIME_REPLACEMENT,'"$BACKEND_URL"',g' {} \;
echo "result: $?, now starting nginx"
nginx -g "daemon off;"
