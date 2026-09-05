#!/usr/bin/env sh
set -eu

python manage.py migrate --noinput
if ! python manage.py aggregate_product_events; then
  echo "warning: product event maintenance failed; continuing startup" >&2
fi
python manage.py runserver 0.0.0.0:8000 --insecure
