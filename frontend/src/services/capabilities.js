import { notify } from '@/services/feedback';
import { isWechatMiniProgram } from '@/services/platform';
import { PRODUCT_EVENTS, trackProductEvent } from '@/services/productAnalytics';
import { request } from '@/utils/httpClient';

export const CAPABILITIES = Object.freeze({
  LISTEN_FEED: 'listen_feed',
  ENTRY_SEARCH: 'entry_search',
  RECORDING: 'recording',
  USAGE_ATTESTATION: 'usage_attestation',
  CURATION_WORKBENCH: 'curation_workbench',
  WECHAT_AUTH: 'wechat_auth',
});

const CAPABILITY_KEYS = Object.values(CAPABILITIES);
const CACHE_KEY = 'product_capabilities_v1';
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;
const REASON_TEXT = {
  not_compiled: '当前版本未包含这项能力，请更新或换用支持的客户端',
  disabled_remotely: '这项功能正在维护，请稍后再试',
};

let remoteCapabilities = Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, true]));
let configSource = 'default';

export function compiledCapabilities() {
  return {
    [CAPABILITIES.LISTEN_FEED]: true,
    [CAPABILITIES.ENTRY_SEARCH]: true,
    [CAPABILITIES.RECORDING]: true,
    [CAPABILITIES.USAGE_ATTESTATION]: true,
    [CAPABILITIES.CURATION_WORKBENCH]: true,
    [CAPABILITIES.WECHAT_AUTH]: isWechatMiniProgram(),
  };
}

function normalizedRemoteCapabilities(value = {}) {
  return Object.fromEntries(CAPABILITY_KEYS.map((key) => [
    key,
    typeof value?.[key] === 'boolean' ? value[key] : true,
  ]));
}

function readCachedCapabilities() {
  const cached = uni.getStorageSync?.(CACHE_KEY);
  if (!cached || typeof cached !== 'object') return null;
  if (Date.now() - Number(cached.saved_at || 0) > MAX_CACHE_AGE_MS) return null;
  return normalizedRemoteCapabilities(cached.capabilities);
}

export function getCapabilityStatus(capability) {
  const compiled = compiledCapabilities()[capability] === true;
  const remotelyEnabled = remoteCapabilities[capability] !== false;
  let reason = '';
  if (!compiled) reason = 'not_compiled';
  else if (!remotelyEnabled) reason = 'disabled_remotely';
  return {
    capability,
    compiled,
    remotely_enabled: remotelyEnabled,
    enabled: compiled && remotelyEnabled,
    reason,
    reason_text: reason ? REASON_TEXT[reason] : '',
    config_source: configSource,
  };
}

export function getCapabilityMatrix() {
  return Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, getCapabilityStatus(key)]));
}

export async function hydrateCapabilities() {
  const cached = readCachedCapabilities();
  if (cached) {
    remoteCapabilities = cached;
    configSource = 'cache';
  }
  try {
    const response = await request('GET', '/site-settings/capabilities', {}, {
      auth: false,
      visitor: false,
      silent: true,
      redirectOnUnauthorized: false,
      loading: false,
      timeout: 3000,
    });
    remoteCapabilities = normalizedRemoteCapabilities(response?.capabilities);
    configSource = 'remote';
    uni.setStorageSync?.(CACHE_KEY, {
      saved_at: Date.now(),
      capabilities: remoteCapabilities,
    });
  } catch (error) {
    if (!cached) configSource = 'unavailable';
  }
  return getCapabilityMatrix();
}

export function isCapabilityEnabled(capability) {
  return getCapabilityStatus(capability).enabled;
}

export function ensureCapability(capability, surface = '') {
  const status = getCapabilityStatus(capability);
  if (status.enabled) return true;
  notify({ title: status.reason_text, icon: 'none' });
  trackProductEvent(PRODUCT_EVENTS.CAPABILITY_DEGRADED, {
    surface,
    result: 'unavailable',
    metadata: { capability, reason: status.reason },
  });
  return false;
}

export function resetCapabilitiesForTests() {
  remoteCapabilities = Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, true]));
  configSource = 'default';
}

export default {
  CAPABILITIES,
  compiledCapabilities,
  ensureCapability,
  getCapabilityMatrix,
  getCapabilityStatus,
  hydrateCapabilities,
  isCapabilityEnabled,
  resetCapabilitiesForTests,
};
