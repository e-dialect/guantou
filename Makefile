.PHONY: check backend-check frontend-check docker-check frontend-e2e

BACKEND_DIR := backend/guantou
FRONTEND_DIR := frontend
PYTHON := $(BACKEND_DIR)/.venv/bin/python

backend-check:
	cd $(BACKEND_DIR) && ./.venv/bin/python manage.py check
	cd $(BACKEND_DIR) && ./.venv/bin/python manage.py makemigrations --check --dry-run
	cd $(BACKEND_DIR) && ./.venv/bin/python manage.py test guantou announcements user siteconfig files inbox
	cd $(BACKEND_DIR) && ./.venv/bin/python -m black --check announcements guantou user siteconfig files inbox utils config

frontend-check:
	cd $(FRONTEND_DIR) && yarn lint
	cd $(FRONTEND_DIR) && yarn test:unit
	cd $(FRONTEND_DIR) && yarn build
	cd $(FRONTEND_DIR) && yarn build:mp-weixin

docker-check:
	docker compose config
	docker compose build backend frontend

frontend-e2e:
	cd $(FRONTEND_DIR) && yarn test:e2e:h5

check: backend-check frontend-check docker-check
