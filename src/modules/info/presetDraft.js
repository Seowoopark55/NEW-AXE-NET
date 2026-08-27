const PREFIX = 'axe-net:preset-draft:v1';

export function presetDraftKey(editor = {}, memberKey = '') {
  const member = encodeURIComponent(String(memberKey || 'member').trim() || 'member');
  const postId = Number(editor.postId);
  const cloneId = Number(editor.cloneFromId);
  const mode = Number.isInteger(postId) && postId > 0
    ? `edit:${postId}`
    : Number.isInteger(cloneId) && cloneId > 0
      ? `clone:${cloneId}`
      : 'new';
  return `${PREFIX}:${member}:${mode}`;
}

export function readPresetDraft(key) {
  if (!key || typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePresetDraft(key, payload) {
  if (!key || typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify({
      ...payload,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    // localStorage가 막혀 있어도 작성 자체는 계속 가능해야 합니다.
  }
}

export function clearPresetDraft(key) {
  if (!key || typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
