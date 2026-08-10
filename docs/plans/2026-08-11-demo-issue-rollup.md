# Remaining Demo Issues Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the remaining upstream issue backlog into a usable, fast-moving demo through small sequential pull requests, while splitting non-demo depth into explicit follow-up issues.

**Architecture:** Keep Django as the source of truth and expose small REST endpoints consumed by shared uni-app pages. H5 is the full acceptance target; WeChat mini-program keeps the core journey and build green; other mini-programs use capability-safe fallbacks. Each PR starts from the latest merged `upstream/main`, must pass local checks and GitHub CI, and is squash-merged before the next branch starts.

**Tech Stack:** Django 4.2, Django REST Framework, SQLite/PostgreSQL-compatible ORM, Vue 3 + uni-app, Vitest, Playwright, GitHub Actions.

---

## PR 4: Passwordless identity and profile integrity

**Branch:** `feat/phone-auth-identity`

**Issues:** #43, #26, #130

### Task 1: Add demo-safe phone verification

**Files:**
- Modify: `backend/guantou/user/verification.py`
- Modify: `backend/guantou/user/urls.py`
- Modify: `backend/guantou/user/views.py`
- Test: `backend/guantou/user/tests.py`

1. Add normalized Mainland China mobile validation, cached one-time codes, a 60-second send throttle, and a configurable 5-minute expiry.
2. Add `POST /users/phone-code` and `POST /login/phone`.
3. Auto-create a passwordless user on first verified login and return `is_new`; reuse the existing account on subsequent logins.
4. Return the code only when `DEBUG` or an explicit demo setting is enabled.
5. Test invalid numbers, throttling, one-time consumption, new registration, repeat login, and telephone uniqueness conflicts.

### Task 2: Harden identity fields

**Files:**
- Modify: `backend/guantou/user/models.py`
- Create: `backend/guantou/user/migrations/0005_user_identity_integrity.py`
- Modify: `backend/guantou/user/view/wechat.py`
- Modify: `backend/guantou/user/view/manage.py`
- Modify: `backend/guantou/user/dto/user_all.py`
- Test: `backend/guantou/user/tests_migrations.py`
- Test: `backend/guantou/user/tests.py`

1. Make birthday nullable and migrate the legacy `1970-01-01` sentinel to null.
2. Add conditional unique constraints for non-empty WeChat, QQ, and telephone identifiers.
3. Replace substring OpenID lookups with exact lookups and translate conflicts to HTTP 409.
4. Keep blank avatars legal and expose a frontend fallback rather than persisting a deployment-specific URL.

### Task 3: Replace the primary login UI

**Files:**
- Modify: `frontend/src/pages/login/login.vue`
- Modify: `frontend/src/services/login.js`
- Create: `frontend/src/services/phoneAuth.js`
- Test: `frontend/tests/unit/phoneAuth.spec.js`

1. Make phone + code the primary H5 login flow with send countdown and demo-code display.
2. Keep account/password as a collapsible fallback.
3. Keep WeChat one-click login and one-click registration under `MP-WEIXIN`, without asking for a password.
4. Reuse `afterLogin` so tokens, draft claiming, onboarding, and interrupted navigation remain consistent.

### Task 4: Verify, publish, and merge PR 4

1. Run backend user tests, frontend unit tests, lint, and H5/mp-weixin builds.
2. Commit with a Conventional Commit subject, push the branch, and open a PR closing #43, #26, and #130.
3. Wait for all required checks, fix failures on the same branch, squash merge, then wait for merged-main CI.

## PR 5: Personal can library, comments, and notifications

**Branch:** `feat/can-library-notifications`

**Issues:** #82, #73, #85

### Task 5: Complete social interaction APIs

**Files:**
- Modify: `backend/guantou/guantou/models.py`
- Modify: `backend/guantou/guantou/serializers.py`
- Modify: `backend/guantou/guantou/views.py`
- Modify: `backend/guantou/inbox/models.py`
- Modify: `backend/guantou/inbox/services.py`
- Create: corresponding migrations
- Test: `backend/guantou/guantou/tests_social.py`
- Test: `backend/guantou/inbox/tests.py`

1. Add comment likes and notification events for comments, comment likes, can likes, reuse, and review outcomes.
2. Return the latest three comments with counts on can detail and keep the paginated all-comments endpoint.
3. Use stable notification verbs and target metadata that the client can route safely.

### Task 6: Build the personal can library and notification center

**Files:**
- Create: `frontend/src/pages/cans/library.vue`
- Modify: `frontend/src/pages/cans/details.vue`
- Modify: `frontend/src/pages/users/me.vue`
- Modify: `frontend/src/pages/mails/*`
- Modify: `frontend/src/pages.json`
- Modify: frontend routers/services/tests

1. Add recorded, liked, and draft tabs with loading/error/actionable empty states.
2. Support playback, detail navigation, reuse entry, and confirmed owner deletion.
3. Add latest comments to can detail plus an all-comments page and comment-like controls.
4. Upgrade the existing inbox UI into a notification center with unread state and target navigation.

### Task 7: Verify, publish, and merge PR 5

Run focused backend/frontend tests, lint, H5/mp-weixin builds, then follow the same PR/CI/squash/main-CI sequence.

## PR 6: Discovery, topics, and dialect circles

**Branch:** `feat/discovery-dialect-circles`

**Issues:** #38, #75, #83, #84

### Task 8: Add circle and topic domain endpoints

**Files:**
- Modify: `backend/guantou/guantou/models.py`
- Modify: `backend/guantou/guantou/serializers.py`
- Modify: `backend/guantou/guantou/views.py`
- Create: corresponding migrations
- Test: focused backend tests

1. Add dialect-linked circles, memberships, list/detail/join/leave, and circle can feeds.
2. Add lightweight topics linked to a Flavor or fixed prompt, with hot/recent discovery lists.
3. Improve the recommendation ordering with engagement and freshness while retaining safe empty fallbacks.
4. Confirm the existing same-dialect feed contract and add regression tests.

### Task 9: Build discovery and circle pages

**Files:**
- Create: `frontend/src/pages/discovery/*`
- Create: `frontend/src/pages/circles/*`
- Modify: homepage/navigation/pages manifest/services/tests

1. Expose hot cans, words, daily prompts, and topics from the discovery entry.
2. Provide circle browse/detail/join/leave and the circle can feed.
3. Route topic participation to can creation with locked context.
4. Share page logic across targets and use conditional compilation only for picker, scrolling, and viewport differences.

### Task 10: Verify, publish, and merge PR 6

Run focused tests and builds, then follow the same PR/CI/squash/main-CI sequence.

## PR 7: Reuse and expression detail demo

**Branch:** `feat/can-expression-flow`

**Issues:** #81, #135, #136, #137, #138, #139, #140

### Task 11: Add the minimum expression model and API

1. Add text-first expressions that can reference a Can, Flavor, source expression, and author.
2. Add paginated detail comments, likes, repost/reuse counters, and deleted-source degradation.
3. Reuse the existing can player and dictionary cards; do not add a second media pipeline.
4. Split voice comments, nested replies, and rich-image authoring into follow-up issues if they cannot fit without destabilizing the demo.

### Task 12: Build expression detail and use-same journeys

1. Add detail loading/error/404 states, content, source attribution, linked dictionary card, and bottom actions.
2. Route “用同款” to the existing can composer with source context.
3. Keep guest reading public and send protected actions through the existing auth-intent guard.
4. Add focused API, unit, build, and H5 journey tests.

### Task 13: Verify, publish, and merge PR 7

Follow the same PR/CI/squash/main-CI sequence.

## PR 8: Theme and governance closeout

**Branch:** `fix/demo-governance-closeout`

**Issues:** #40, #89, #90, #131, #132, #134, #147

### Task 14: Finish integrity and audit work

1. Add stable parsing/normalization tests for legacy transition audit records and document the schema.
2. Add safe nullable/protected ownership semantics for deleting users and test every affected model.
3. Add stable notification verbs, shelf item ordering metadata, and site-setting reference validation where still missing.
4. Close already-completed row-lock work with regression coverage; create a follow-up issue for a relational transition-event model instead of blocking the demo.

### Task 15: Add theme switching and audit the issue backlog

1. Add system/light/dark theme selection with persisted preference and H5/mini-program-safe application.
2. Audit all remaining issues, close stale or superseded items with links to the implementing PRs, and update milestones.
3. Leave #72 deferred and document why old demo data is intentionally excluded.
4. Keep breaking public field renames (#133) deferred behind a versioned API migration issue unless a backward-compatible alias is trivial.

### Task 16: Final verification, merge, and deploy

1. Run the full backend suite, frontend unit/lint suite, H5 + mp-weixin builds, H5 E2E, and Docker validation.
2. Merge PR 8 only after required checks pass and wait for final `main` CI.
3. Manually smoke-test guest search, phone/WeChat login, can contribution/review, personal library, notifications, discovery/circles, collection authoring, pronunciation authoring, and expression reuse.
4. Trigger `Deploy H5 to Tencent COS` exactly once using the existing demo prefix and confirmed demo backend URL. If repository configuration still lacks a safe backend URL, do not guess; file a deployment-configuration issue and report the exact blocker.
