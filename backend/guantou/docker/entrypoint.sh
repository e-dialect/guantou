#!/usr/bin/env sh
set -eu

python manage.py migrate --noinput
python manage.py runserver 0.0.0.0:8000 --insecure
