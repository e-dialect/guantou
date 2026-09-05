/** Theme preview composition and live style hydration. */
import { isWechatMiniProgram } from '@/services/platform';
import {
  trackThemePerfError,
  trackThemePerfStyle,
} from '@/services/themeAnalytics';
import {
  LOCAL_DRESS_GROUPS,
  P1_DRESS_GROUP_IDS,
  THEME_PREVIEW_SAMPLE,
  canLivePreview,
  catalogStatus,
  getActiveTheme,
  getDressGroup,
  getDressItem,
  getRenderableTheme,
  getThemeById,
  hasPermission,
  isDressBlocked,
} from '@/services/theme/catalog';
import {
  getLocalDressMap,
  getOverlayLocalDress,
} from '@/services/theme/store';
import { bindThemeRenderPort } from '@/services/theme/renderPort';
import {
  applyOutfitStyle,
  flattenStyleJson,
  resolveOutfitStyle,
} from '@/services/themeSchema';

export function listAppliedDress({ isMiniProgram = false } = {}) {
  const selected = getLocalDressMap();
  const overlay = getOverlayLocalDress();
  return LOCAL_DRESS_GROUPS.flatMap((group) => {
    const item = getDressItem(selected[group.id]);
    if (!item) return [];
    const blocked = isDressBlocked(item, group, isMiniProgram);
    return [{
      group,
      item,
      empty: false,
      suppressed: overlay,
      blocked,
      effective: !overlay && !blocked && hasPermission('dress', item),
    }];
  });
}

export function listOutfitHubDress({ isMiniProgram = false } = {}) {
  const applied = listAppliedDress({ isMiniProgram });
  const byGroup = Object.fromEntries(applied.map((entry) => [entry.group.id, entry]));
  const overlay = getOverlayLocalDress();
  const seen = new Set();
  const rows = [];
  const pushGroup = (group) => {
    if (!group || seen.has(group.id)) return;
    if (isMiniProgram && group.mpBlocked && !byGroup[group.id]) return;
    seen.add(group.id);
    if (byGroup[group.id]) {
      rows.push(byGroup[group.id]);
      return;
    }
    rows.push({
      group,
      item: null,
      empty: true,
      suppressed: overlay,
      blocked: Boolean(group.mpBlocked && isMiniProgram),
      effective: false,
    });
  };
  P1_DRESS_GROUP_IDS.forEach((id) => pushGroup(getDressGroup(id)));
  applied.forEach((entry) => pushGroup(entry.group));
  return rows;
}

export function listSelectedLocalDress() {
  return listAppliedDress().map((entry) => entry.item.name);
}

export function buildLivePreview({
  theme,
  dressItems = [],
  isMiniProgram = false,
  overlay = false,
} = {}) {
  const skipped = [];
  const effective = [];
  dressItems.forEach((entry) => {
    const group = entry.group || getDressGroup(entry.item?.group);
    const blocked = isDressBlocked(entry.item, group, isMiniProgram);
    const live = canLivePreview(entry.item);
    const inactive = overlay || blocked || !live;
    if (inactive) {
      let hint = '该装扮当前环境不生效';
      if (!live) {
        hint = catalogStatus(entry.item) === 'ended'
          ? '该装扮已绝版，无法再次使用'
          : '装扮素材即将上线';
      } else if (overlay) {
        hint = '已被全局主题覆盖';
      }
      skipped.push({
        item: entry.item,
        group,
        blocked,
        hint,
      });
      return;
    }
    effective.push({
      item: entry.item,
      group,
      blocked: false,
    });
  });
  const shotClass = [`shot-${theme?.preview || 'default'}`];
  effective.forEach((row) => {
    if (row.group?.id) shotClass.push(`dress-${row.group.id}`);
  });
  const resolved = resolveOutfitStyle({
    theme,
    dressItems: overlay ? [] : effective,
    overlay,
    isMiniProgram,
  });
  return {
    theme,
    shotClass,
    skipped,
    nativeLocked: Boolean(isMiniProgram),
    sample: THEME_PREVIEW_SAMPLE,
    vars: resolved.vars,
  };
}

export function themePreviewVars(item) {
  return flattenStyleJson(item?.style_json).vars;
}

export function composePreviewOutfit({
  themeId,
  localDress,
  overlay,
  extraDress = null,
  isMiniProgram = false,
} = {}) {
  const theme = getThemeById(themeId) || getActiveTheme();
  const overlayFlag = overlay === undefined ? getOverlayLocalDress() : Boolean(overlay);
  const selected = { ...(localDress || getLocalDressMap()) };
  if (extraDress?.group) {
    selected[extraDress.group] = extraDress.id;
  }
  const dressItems = Object.entries(selected).flatMap(([groupId, itemId]) => {
    const item = getDressItem(itemId);
    const group = getDressGroup(groupId);
    if (!item || !group) return [];
    return [{ item, group }];
  });
  return buildLivePreview({
    theme,
    dressItems,
    isMiniProgram,
    overlay: overlayFlag,
  });
}

let lastHydratePerfAt = 0;

function reportHydratePerf({ hydrateMs, layerCount, ok }) {
  const now = Date.now();
  if (now - lastHydratePerfAt < 2000 && ok) return;
  lastHydratePerfAt = now;
  trackThemePerfStyle({ hydrateMs, layerCount });
  if (!ok) trackThemePerfError('style_json');
}

export function hydrateOutfitStyle() {
  const started = Date.now();
  const isMiniProgram = isWechatMiniProgram();
  const overlay = getOverlayLocalDress();
  const applied = listAppliedDress({ isMiniProgram });
  const dressItems = overlay ? [] : applied.filter((row) => row.effective);
  const resolved = resolveOutfitStyle({
    theme: getRenderableTheme(),
    dressItems,
    overlay,
    isMiniProgram,
  });
  const result = applyOutfitStyle(resolved);
  reportHydratePerf({
    hydrateMs: Date.now() - started,
    layerCount: 1 + dressItems.length,
    ok: resolved.ok,
  });
  return result;
}

bindThemeRenderPort(hydrateOutfitStyle);
