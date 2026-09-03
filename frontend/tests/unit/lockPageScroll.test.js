import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import lockPageScroll from '@/utils/lockPageScroll';

describe('H5 page scroll lock', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    vi.restoreAllMocks();
  });

  it('preserves the visible position and restores both scroll coordinates', () => {
    vi.spyOn(window, 'scrollX', 'get').mockReturnValue(12);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(340);
    const release = lockPageScroll();
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-340px');
    expect(document.body.style.left).toBe('-12px');
    expect(document.documentElement.style.overflow).toBe('hidden');
    release();
    expect(document.body.style.position).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 12, top: 340, behavior: 'instant' });
  });

  it('restores existing inline values and priorities without overwriting unrelated edits', () => {
    document.body.style.setProperty('position', 'relative', 'important');
    document.body.style.top = '20px';
    document.body.style.width = '90%';
    document.documentElement.style.overflow = 'auto';
    const release = lockPageScroll();
    document.body.style.padding = '10px';
    release();
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.getPropertyPriority('position')).toBe('important');
    expect(document.body.style.top).toBe('20px');
    expect(document.body.style.width).toBe('90%');
    expect(document.body.style.padding).toBe('10px');
    expect(document.documentElement.style.overflow).toBe('auto');
  });

  it('releases only once', () => {
    const release = lockPageScroll();
    release();
    document.body.style.position = 'absolute';
    release();
    expect(document.body.style.position).toBe('absolute');
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('does not access the DOM outside H5', () => {
    vi.stubGlobal('document', undefined);
    const release = lockPageScroll();
    expect(release).toBeTypeOf('function');
    release();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
