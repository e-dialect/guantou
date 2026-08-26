# Frontend UI instructions

These instructions apply to everything under `frontend/`.

## Component choice

TDesign UniApp is the standard library for generic interactive controls. Preserve custom business visuals such as can cards, nameplates, the immersive home feed, and page shells.

Use the project primitives first:

- `BaseButton` for ordinary primary, outline, danger, and light-on-dark actions.
- `BaseForm` and `BaseField` for forms, validation, inputs, passwords, numbers, and textareas.
- `BaseLoading` for page or section loading states.
- `EmptyState` for empty results and retry actions.
- `services/feedback.js` or `ConfirmDialog` for toast, message, and confirmation feedback.

Use TDesign directly for complex, low-frequency controls such as Picker, Popup, Tabs, Cell, Upload, Switch, and DateTimePicker. Import npm components explicitly in the page or component:

```js
import TPicker from '@tdesign/uniapp/picker/picker.vue';
```

Do not rely on npm easycom for mini-program builds.

## Forms

```vue
<BaseForm ref="form" :data="form" :rules="rules">
  <BaseField
    v-model="form.nickname"
    name="nickname"
    label="昵称"
    required
  />
  <BaseButton block text="保存" @click="save" />
</BaseForm>
```

Validate through `await this.$refs.form.validate()` and submit only when the result is `true`. Keep API payload construction in the page or service; the primitives must not know business models.

## New and migrated UI

Do not add raw `button`, `input`, `textarea`, `picker`, `switch`, `radio`, or `checkbox` controls. Do not add `uni-ui` forms or `cu-*` classes. Structural uni-app elements such as `view`, `text`, `image`, and `scroll-view` remain valid.

Do not duplicate TDesign theme imports or add page-local `--td-*` overrides for generic styling. Theme values come from `src/styles/tokens.scss`. Do not call `uni.showModal` directly; use the shared feedback layer.

If a platform capability, focus behavior, picker dependency, or business interaction is unclear, stop the migration and create a page-specific issue. Preserve the legacy control behind `legacy-form-compat.scss` until the issue is resolved.

## Definition of done for a migrated page

- No raw interactive controls, `uni-ui` forms, or `cu-*` classes remain.
- Existing route, service calls, payloads, and success/error behavior are preserved.
- Relevant unit tests cover payload and navigation behavior.
- H5 is checked at 390×844 in light and dark themes.
- `npm run lint`, `npm run test:unit`, `npm run build:h5`, and `npm run build:mp-weixin` pass in proportion to the change.
- Update `docs/TDESIGN_MIGRATION.md` and link the page PR or issue.
