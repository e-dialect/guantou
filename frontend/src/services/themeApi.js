import { isLoggedIn } from '@/services/authGuard';
import {
  bindThemeNetworkFlush,
  clearThemeLocalState,
  flushThemeCloudQueue,
  guestThemeSnapshot,
  handleThemeAccountLogin,
  setThemeCatalogFetcher,
  setThemeCloudFlusher,
  setThemeMemberFetcher,
} from '@/services/themeFault';
import {
  currentTerminal,
  fromCurrentConfig,
  fromDecorationItem,
  fromThemeItem,
  THEME_API_PATHS,
  toCollectList,
  toCurrentConfig,
  toSavedMix,
} from '@/services/themeSchema';
import {
  bindThemeRuntimeAdapters,
  themeRuntime,
} from '@/services/themeRuntime';
import { request } from '@/utils/httpClient';

const silent = {
  silent: true,
  loading: false,
  redirectOnUnauthorized: false,
  timeout: 15000,
};

async function fetchPaged(path) {
  const pageSize = 100;
  const collected = [];
  let catalogVersion = 1;
  let page = 1;
  /* Catalog pages must follow `next`; fetching them in parallel would skip or duplicate rows. */
  /* eslint-disable no-await-in-loop */
  while (page <= 30) {
    // Catalog pages are cursor-like: the next request depends on this response.
    // eslint-disable-next-line no-await-in-loop
    const data = await request('GET', path, { page, page_size: pageSize }, {
      ...silent,
      auth: false,
    });
    catalogVersion = data?.catalog_version || catalogVersion;
    const rows = data?.results || [];
    collected.push(...rows);
    if (!data?.next || rows.length === 0) break;
    page += 1;
  }
  /* eslint-enable no-await-in-loop */
  return {
    results: collected,
    catalog_version: catalogVersion,
  };
}

export async function fetchThemeCatalog() {
  const settled = await Promise.allSettled([
    fetchPaged(THEME_API_PATHS.themes),
    fetchPaged(THEME_API_PATHS.decorations),
  ]);
  const themes = settled[0];
  const decorations = settled[1];
  if (themes.status === 'rejected' && decorations.status === 'rejected') {
    throw themes.reason;
  }
  const themePage = themes.status === 'fulfilled'
    ? themes.value
    : { results: [], catalog_version: 0 };
  const dressPage = decorations.status === 'fulfilled'
    ? decorations.value
    : { results: [], catalog_version: 0 };
  return {
    themes: (themePage.results || []).map(fromThemeItem).filter(Boolean),
    dresses: (dressPage.results || []).map(fromDecorationItem).filter(Boolean),
    catalog_version: themePage.catalog_version || dressPage.catalog_version || 1,
  };
}

export async function fetchThemeMemberStatus() {
  const data = await request('GET', THEME_API_PATHS.entitlement, {}, silent);
  return {
    is_member: Boolean(data?.is_member),
    creator_unlocked: Boolean(data?.creator_unlocked),
    activity_ids: Array.isArray(data?.activity_ids) ? data.activity_ids : [],
  };
}

export async function fetchThemeConfig() {
  return request('GET', THEME_API_PATHS.config, {}, silent);
}

function collectKey(row) {
  return `${row.item_type}:${row.item_id}`;
}

async function syncCollects(favorites) {
  if (!favorites) return;
  const local = toCollectList(favorites).collect_list || [];
  const remote = await request('GET', THEME_API_PATHS.collects, {}, silent);
  const remoteList = remote?.collect_list || [];
  const remoteKeys = new Set(remoteList.map(collectKey));
  const localKeys = new Set(local.map(collectKey));
  await Promise.all(local
    .filter((row) => !remoteKeys.has(collectKey(row)))
    .map((row) => request('POST', THEME_API_PATHS.collects, {
      item_id: row.item_id,
      item_type: row.item_type,
    }, silent)));
  await Promise.all(remoteList
    .filter((row) => !localKeys.has(collectKey(row)))
    .map((row) => request(
      'DELETE',
      `${THEME_API_PATHS.collects}${row.item_id}/?item_type=${encodeURIComponent(row.item_type)}`,
      {},
      silent,
    )));
}

async function syncMixes(outfits) {
  if (!Array.isArray(outfits)) return;
  const local = outfits.map((outfit) => toSavedMix(outfit)).filter(Boolean);
  const remote = await request('GET', THEME_API_PATHS.mixes, {}, silent);
  const remoteList = Array.isArray(remote) ? remote : [];
  const remoteById = new Map(remoteList.map((row) => [row.mix_id, row]));
  const remoteIds = new Set(remoteList.map((row) => row.mix_id));
  const localIds = new Set(local.map((row) => row.mix_id));
  await Promise.all(local
    .filter((row) => !remoteIds.has(row.mix_id))
    .map((row) => request('POST', THEME_API_PATHS.mixes, row, silent)));
  await Promise.all(local
    .filter((row) => (
      remoteById.has(row.mix_id)
      && remoteById.get(row.mix_id)?.mix_name !== row.mix_name
    ))
    .map((row) => request(
      'PATCH',
      `${THEME_API_PATHS.mixes}${row.mix_id}/`,
      { mix_name: row.mix_name },
      silent,
    )));
  await Promise.all(remoteList
    .filter((row) => !localIds.has(row.mix_id))
    .map((row) => request('DELETE', `${THEME_API_PATHS.mixes}${row.mix_id}/`, {}, silent)));
}

export async function flushThemeConfig(payload = {}) {
  const body = toCurrentConfig({
    themeId: payload.themeId,
    localDress: payload.localDress || {},
    overlay: payload.overlay !== false,
    recent: payload.recent || [],
  });
  await request('PUT', THEME_API_PATHS.config, {
    ...body,
    platform: currentTerminal(),
  }, silent);
  let syncFailed = false;
  try {
    await syncCollects(payload.favorites);
    await syncMixes(payload.outfits);
  } catch {
    syncFailed = true;
  }
  return { ok: true, syncFailed };
}

export async function pullThemeCloudState() {
  if (!isLoggedIn()) return { ok: false, reason: 'guest' };
  if (guestThemeSnapshot()) return { ok: false, reason: 'merge-pending' };
  const pending = await flushThemeCloudQueue();
  if (!pending.ok) return { ok: false, reason: 'sync-pending' };
  const config = await fetchThemeConfig();
  const runtime = themeRuntime();
  runtime.hydrateFromCloudConfig(config);
  try {
    const remote = await request('GET', THEME_API_PATHS.collects, {}, silent);
    runtime.hydrateFavoriteMap(remote?.collect_list);
  } catch {
    // Keep local favorites; apply/config already landed.
  }
  try {
    const mixes = await request('GET', THEME_API_PATHS.mixes, {}, silent);
    if (Array.isArray(mixes)) runtime.hydrateSavedOutfits(mixes);
  } catch {
    // Keep local mixes; config already landed.
  }
  return { ok: true, config };
}

export async function afterThemeLogin(userId) {
  const result = await handleThemeAccountLogin(userId);
  if (!result.merge) {
    try {
      await pullThemeCloudState();
    } catch {
      // Keep the local snapshot; theme-center can retry.
    }
  }
  return result;
}

export function afterThemeLogout() {
  clearThemeLocalState();
}

export async function applyThemeRemote(itemType, itemId) {
  return request('POST', THEME_API_PATHS.apply, {
    item_type: itemType,
    item_id: itemId,
    platform: currentTerminal(),
  }, silent);
}

export async function claimThemeRemote(itemType, itemId) {
  return request('POST', THEME_API_PATHS.entitlement, {
    item_type: itemType,
    item_id: itemId,
  }, silent);
}

export async function collectThemeRemote(itemType, itemId) {
  return request('POST', THEME_API_PATHS.collects, {
    item_id: itemId,
    item_type: itemType,
  }, silent);
}

export async function uncollectThemeRemote(itemType, itemId) {
  return request(
    'DELETE',
    `${THEME_API_PATHS.collects}${itemId}/?item_type=${encodeURIComponent(itemType)}`,
    {},
    silent,
  );
}

export function createMixRemote(payload) {
  return request('POST', THEME_API_PATHS.mixes, payload, silent);
}

export function renameMixRemote(mixId, name) {
  return request('PATCH', `${THEME_API_PATHS.mixes}${mixId}/`, { mix_name: name }, silent);
}

export function deleteMixRemote(mixId) {
  return request('DELETE', `${THEME_API_PATHS.mixes}${mixId}/`, {}, silent);
}

export function postThemeEvent(event, itemId = '') {
  return request('POST', THEME_API_PATHS.events, {
    event,
    item_id: itemId || '',
  }, {
    ...silent,
    auth: isLoggedIn(),
  }).catch(() => null);
}

export function bindThemeAdapters() {
  setThemeCatalogFetcher(fetchThemeCatalog);
  setThemeCloudFlusher(flushThemeConfig);
  setThemeMemberFetcher(fetchThemeMemberStatus);
  bindThemeNetworkFlush();
}

export { fromCurrentConfig };

bindThemeRuntimeAdapters({
  postThemeEvent,
  pullThemeCloudState,
});
