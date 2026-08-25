export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function bindImeSafeInput(input, onValue, options = {}) {
  if (!input || typeof onValue !== 'function') return () => {};

  const delay = Number.isFinite(Number(options.delay)) ? Number(options.delay) : 220;
  let composing = false;
  let timer = null;

  const emit = () => {
    clearTimeout(timer);
    timer = null;
    onValue(input.value);
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(emit, delay);
  };

  const handleInput = (event) => {
    if (composing || event?.isComposing) return;
    schedule();
  };

  const handleCompositionStart = () => {
    composing = true;
    clearTimeout(timer);
  };

  const handleCompositionEnd = () => {
    composing = false;
    schedule();
  };

  const handleChange = () => {
    if (!composing) emit();
  };

  input.addEventListener('compositionstart', handleCompositionStart);
  input.addEventListener('compositionend', handleCompositionEnd);
  input.addEventListener('input', handleInput);
  input.addEventListener('change', handleChange);

  return () => {
    clearTimeout(timer);
    input.removeEventListener('compositionstart', handleCompositionStart);
    input.removeEventListener('compositionend', handleCompositionEnd);
    input.removeEventListener('input', handleInput);
    input.removeEventListener('change', handleChange);
  };
}

export function captureImeSearchFocus(root = document) {
  const active = document.activeElement;
  if (!active || !root?.contains?.(active) || !active.hasAttribute?.('data-ime-search')) return null;

  return {
    key: active.getAttribute('data-ime-search') || '',
    start: typeof active.selectionStart === 'number' ? active.selectionStart : null,
    end: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
  };
}

export function restoreImeSearchFocus(root = document, snapshot = null) {
  if (!snapshot?.key) return;
  const next = [...root.querySelectorAll('[data-ime-search]')]
    .find((element) => element.getAttribute('data-ime-search') === snapshot.key);
  if (!next) return;

  next.focus({ preventScroll: true });
  if (snapshot.start == null) return;

  const max = String(next.value || '').length;
  const start = Math.min(snapshot.start, max);
  const end = Math.min(snapshot.end ?? snapshot.start, max);
  try { next.setSelectionRange(start, end); } catch { /* search inputs may reject selection in edge cases */ }
}
