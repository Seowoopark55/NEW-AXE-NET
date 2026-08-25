import { store } from '../../state/store.js';
import {
  deleteKnowledge,
  fetchAiWorkspace,
  saveKnowledge,
  setKnowledgeActive,
  updateUnknownStatus,
  resolveUnknownWithKnowledge,
} from './aiService.js';
import { renderAiView } from './aiView.js';

const TABS = new Set(['dashboard', 'knowledge', 'unknown', 'logs']);
let loadPromise = null;

export async function initAiModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  const rerender = () => {
    const state = store.getState();
    if (state.ui.activeModule !== 'ai') return;

    renderAiView(root, state, {
      onTabChange(tab) {
        store.updateState((current) => ({
          ...current,
          ai: { ...current.ai, tab: TABS.has(tab) ? tab : 'dashboard' },
        }));
      },
      onFilterChange(key, value) {
        store.updateState((current) => ({
          ...current,
          ai: { ...current.ai, filters: { ...current.ai.filters, [key]: value } },
        }));
      },
      onOpenCreate() { openEditor(null, null); },
      onEditKnowledge(id) { openEditor(Number(id), null); },
      onOpenUnknown(id) { openEditor(null, Number(id)); },
      onCloseEditor() { closeEditor(); },
      async onLinkUnknownToKnowledge(unknownId, knowledgeId) {
        if (!isAdmin()) return;
        const state = store.getState();
        const knowledge = state.ai.knowledge.find((item) => Number(item.id) === Number(knowledgeId));
        const question = state.ai.unknown.find((item) => Number(item.id) === Number(unknownId));
        if (!knowledge || !question) return;
        if (!window.confirm(`"${question.question}"\n\n미답변을 기존 지식 "${knowledge.title}"에 연결할까요?`)) return;
        try {
          await resolveUnknownWithKnowledge(unknownId, knowledgeId);
          closeEditor();
          await reloadAiWorkspace({ silent: true });
          store.updateState((current) => ({
            ...current,
            ai: { ...current.ai, message: `미답변을 기존 지식 "${knowledge.title}"에 연결했습니다.` },
          }));
        } catch (error) { window.alert(formatError(error)); }
      },
      async onSaveKnowledge(values) { await handleSave(values); },
      async onToggleKnowledge(id, active) {
        if (!isAdmin()) return;
        try {
          await setKnowledgeActive(id, active);
          await reloadAiWorkspace({ silent: true });
        } catch (error) { window.alert(formatError(error)); }
      },
      async onDeleteKnowledge(id) {
        if (!isAdmin() || !window.confirm('이 AI 지식을 삭제할까요? 별칭도 함께 삭제됩니다.')) return;
        try {
          await deleteKnowledge(id);
          await reloadAiWorkspace({ silent: true });
        } catch (error) { window.alert(formatError(error)); }
      },
      async onIgnoreUnknown(id) {
        if (!isAdmin()) return;
        try {
          await updateUnknownStatus(id, 'ignored');
          await reloadAiWorkspace({ silent: true });
        } catch (error) { window.alert(formatError(error)); }
      },
      async onReopenUnknown(id) {
        if (!isAdmin()) return;
        try {
          await updateUnknownStatus(id, 'open');
          await reloadAiWorkspace({ silent: true });
        } catch (error) { window.alert(formatError(error)); }
      },
      async onRefresh() { await reloadAiWorkspace(); },
    });

    if (state.auth.admin && !state.ai.initialized && !state.ai.loading && !loadPromise) {
      void reloadAiWorkspace();
    }
  };

  rerender();
  store.subscribe(rerender);
}

function isAdmin() { return Boolean(store.getState().auth.admin); }

function openEditor(knowledgeId, sourceUnknownId) {
  if (!isAdmin()) return;
  store.updateState((state) => ({
    ...state,
    ai: {
      ...state.ai,
      editor: { open: true, knowledgeId, sourceUnknownId, saving: false, error: null },
    },
  }));
}

function closeEditor() {
  store.updateState((state) => ({
    ...state,
    ai: { ...state.ai, editor: { open: false, knowledgeId: null, sourceUnknownId: null, saving: false, error: null } },
  }));
}

async function handleSave(values) {
  if (!isAdmin()) return;
  const editor = store.getState().ai.editor;
  store.updateState((state) => ({
    ...state,
    ai: { ...state.ai, editor: { ...state.ai.editor, saving: true, error: null } },
  }));
  try {
    await saveKnowledge({ ...values, sourceUnknownId: editor.sourceUnknownId }, editor.knowledgeId);
    await reloadAiWorkspace({ silent: true });
    closeEditor();
    store.updateState((state) => ({ ...state, ai: { ...state.ai, message: 'AI 지식이 저장되었습니다.' } }));
  } catch (error) {
    store.updateState((state) => ({
      ...state,
      ai: { ...state.ai, editor: { ...state.ai.editor, saving: false, error: formatError(error) } },
    }));
  }
}

async function reloadAiWorkspace(options = {}) {
  if (!isAdmin()) return;
  if (loadPromise) return loadPromise;

  if (!options.silent) {
    store.updateState((state) => ({ ...state, ai: { ...state.ai, loading: true, error: null, message: null } }));
  }

  loadPromise = fetchAiWorkspace()
    .then((data) => {
      store.updateState((state) => ({
        ...state,
        ai: { ...state.ai, ...data, initialized: true, loading: false, error: null },
      }));
    })
    .catch((error) => {
      console.error('[AXE NET] AXE AI workspace load failed:', error);
      store.updateState((state) => ({
        ...state,
        ai: { ...state.ai, initialized: true, loading: false, error: formatError(error) },
      }));
    })
    .finally(() => { loadPromise = null; });

  return loadPromise;
}

function formatError(error) {
  const message = error?.message || String(error);
  if (/row-level security|permission denied/i.test(message)) return 'AXE AI 관리 권한이 없습니다. 관리자 로그인 상태를 확인하세요.';
  if (error?.code === 'AXE_AI_DUPLICATE_KNOWLEDGE') return '이미 같은 제목 또는 별칭의 AI 지식이 있습니다. 기존 지식에 연결하거나 기존 지식을 수정하세요.';
  if (/duplicate key/i.test(message)) return '이미 같은 원본 키 또는 별칭이 등록되어 있습니다.';
  return message;
}
