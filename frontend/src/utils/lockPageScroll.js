// H5 modal lock. Fixed positioning also prevents touch scrolling on iOS;
// overflow:hidden alone does not reliably lock the document there.
export default function lockPageScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};

  const x = window.scrollX;
  const y = window.scrollY;
  const saved = [];
  const setStyle = (element, property, value) => {
    saved.push({
      element,
      property,
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    });
    element.style.setProperty(property, value);
  };
  setStyle(document.documentElement, 'overflow', 'hidden');
  setStyle(document.documentElement, 'overscroll-behavior', 'none');
  setStyle(document.body, 'position', 'fixed');
  setStyle(document.body, 'top', `${-y}px`);
  setStyle(document.body, 'left', `${-x}px`);
  setStyle(document.body, 'width', '100%');
  setStyle(document.body, 'overflow', 'hidden');

  let released = false;
  return () => {
    if (released) return;
    released = true;
    saved.forEach(({
      element, property, value, priority,
    }) => {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    });
    // Restore immediately even if the page normally uses smooth scrolling.
    window.scrollTo({ left: x, top: y, behavior: 'instant' });
  };
}
