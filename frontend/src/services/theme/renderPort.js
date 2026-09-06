const unboundResult = () => ({ ok: false, reason: 'unbound' });

let hydrateOutfitStyleAdapter = unboundResult;

export function bindThemeRenderPort(adapter) {
  if (typeof adapter !== 'function') {
    throw new TypeError('Theme render adapter must be a function');
  }
  const previous = hydrateOutfitStyleAdapter;
  hydrateOutfitStyleAdapter = adapter;
  return () => {
    hydrateOutfitStyleAdapter = previous;
  };
}

export function hydrateOutfitStyle(...args) {
  return hydrateOutfitStyleAdapter(...args);
}
