#!/usr/bin/env bash
# Render build step: install dependencies, collect static files, apply migrations.
# Free-tier Render has no pre-deploy hook, so migrations run as part of the build.
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input
