.PHONY: check setup backend-check frontend-check materials-check docker-check commit-messages-check frontend-e2e smoke

BACKEND_DIR := backend/guantou
FRONTEND_DIR := frontend
PYTHON := $(BACKEND_DIR)/.venv/bin/python

setup:
	cd $(BACKEND_DIR) && python3.12 -m venv .venv
	cd $(BACKEND_DIR) && ./.venv/bin/python -m pip install --upgrade pip
	cd $(BACKEND_DIR) && ./.venv/bin/python -m pip install -r requirements.txt
	cd $(FRONTEND_DIR) && yarn install --frozen-lockfile --production=false

backend-check:
	cd $(BACKEND_DIR) && ./.venv/bin/python manage.py check
	cd $(BACKEND_DIR) && ./.venv/bin/python manage.py makemigrations --check --dry-run
	cd $(BACKEND_DIR) && ./.venv/bin/python manage.py test guantou announcements user siteconfig files inbox audit
	cd $(BACKEND_DIR) && ./.venv/bin/python -m black --check announcements guantou user siteconfig files inbox audit utils config

frontend-check:
	cd $(FRONTEND_DIR) && yarn lint
	cd $(FRONTEND_DIR) && yarn test:unit
	cd $(FRONTEND_DIR) && yarn build
	cd $(FRONTEND_DIR) && yarn build:mp-weixin

materials-check:
	$(PYTHON) -m unittest discover tools/materials/tests

docker-check:
	docker compose config
	docker compose build backend frontend

commit-messages-check:
	node scripts/check-commit-messages.js "$${BASE_REF:-origin/main}" "$${HEAD_REF:-HEAD}"

frontend-e2e:
	cd $(FRONTEND_DIR) && yarn wait:e2e:h5
	cd $(FRONTEND_DIR) && yarn test:e2e:h5

smoke:
	docker compose up -d --build
	cd $(FRONTEND_DIR) && yarn wait:e2e:h5
	cd $(FRONTEND_DIR) && yarn test:e2e:h5

check: backend-check frontend-check materials-check commit-messages-check docker-check
