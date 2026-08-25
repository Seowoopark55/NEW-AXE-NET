import { store } from '../../state/store.js';
import {
  deleteNotice,
  deleteOperationRule,
  fetchNotices,
  fetchOperationRules,
  saveNotice,
  saveOperationRule,
} from './noticeService.js';
import { renderNoticeView } from './noticeView.js';

export async function initNoticeModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  const rerender = () => {
    if (store.getState().ui.activeModule !== 'notice') return;

    renderNoticeView(root, store.getState(), {
      onTabChange(tab) {
        const nextTab = ['general', 'patch', 'operations'].includes(tab) ? tab : 'general';
        store.updateState((state) => ({
          ...state,
          notice: {
            ...state.notice,
            tab: nextTab,
            selectedNoticeId: null,
            selectedOperationId: null,
            operationCategory: 'all',
            editor: closeEditorState(),
          },
        }));
      },

      onOpenNotice(id) {
        store.updateState((state) => ({
          ...state,
          notice: {
            ...state.notice,
            selectedNoticeId: Number(id),
            editor: closeEditorState(),
          },
        }));
      },

      onBackNotice() {
        store.updateState((state) => ({
          ...state,
          notice: {
            ...state.notice,
            selectedNoticeId: null,
            editor: closeEditorState(),
          },
        }));
      },

      onSelectOperation(id) {
        store.updateState((state) => ({
          ...state,
          notice: {
            ...state.notice,
            selectedOperationId: Number(id),
            editor: closeEditorState(),
          },
        }));
      },

      onOperationCategoryChange(category) {
        store.updateState((state) => ({
          ...state,
          notice: {
            ...state.notice,
            operationCategory: category || 'all',
            selectedOperationId: null,
          },
        }));
      },

      onOpenEditor(kind, id = null) {
        if (!store.getState().auth.admin) return;
        store.updateState((state) => ({
          ...state,
          notice: {
            ...state.notice,
            editor: {
              open: true,
              kind: kind === 'operation' ? 'operation' : 'notice',
              itemId: id ? Number(id) : null,
              saving: false,
              error: null,
            },
          },
        }));
      },

      onCloseEditor() {
        store.updateState((state) => ({
          ...state,
          notice: {
            ...state.notice,
            editor: closeEditorState(),
          },
        }));
      },

      async onSaveEditor(kind, values) {
        if (!store.getState().auth.admin) return;
        setEditorSaving(true, null);

        try {
          validateEditor(kind, values);
          const id = kind === 'operation'
            ? await saveOperationRule(values)
            : await saveNotice(values);
          await reloadNoticeData({ preserveSelection: false });

          store.updateState((state) => ({
            ...state,
            notice: {
              ...state.notice,
              tab: kind === 'operation'
                ? 'operations'
                : (values.notice_type === '패치노트' ? 'patch' : 'general'),
              selectedNoticeId: kind === 'notice' ? Number(id) : null,
              selectedOperationId: kind === 'operation' ? Number(id) : null,
              editor: closeEditorState(),
            },
          }));
        } catch (error) {
          console.error('[AXE NET] notice save failed:', error);
          setEditorSaving(false, formatNoticeError(error));
        }
      },

      async onDeleteNotice(id) {
        if (!store.getState().auth.admin) return;
        if (!window.confirm('이 공지를 삭제할까요?')) return;

        try {
          await deleteNotice(id);
          await reloadNoticeData({ preserveSelection: false });
        } catch (error) {
          window.alert(formatNoticeError(error));
        }
      },

      async onDeleteOperation(id) {
        if (!store.getState().auth.admin) return;
        if (!window.confirm('이 운영기준을 목록에서 내릴까요?')) return;

        try {
          await deleteOperationRule(id);
          await reloadNoticeData({ preserveSelection: false });
        } catch (error) {
          window.alert(formatNoticeError(error));
        }
      },

      async onRefresh() {
        await reloadNoticeData({ preserveSelection: true });
      },
    });
  };

  rerender();
  store.subscribe(rerender);
  await reloadNoticeData({ preserveSelection: true });
}

async function reloadNoticeData(options = {}) {
  store.updateState((state) => ({
    ...state,
    notice: {
      ...state.notice,
      loading: true,
      error: null,
    },
  }));

  try {
    const [notices, operations] = await Promise.all([
      fetchNotices(),
      fetchOperationRules(),
    ]);

    store.updateState((state) => ({
      ...state,
      notice: {
        ...state.notice,
        initialized: true,
        loading: false,
        error: null,
        notices,
        operations,
        selectedNoticeId: options.preserveSelection ? state.notice.selectedNoticeId : null,
        selectedOperationId: options.preserveSelection ? state.notice.selectedOperationId : null,
      },
    }));
  } catch (error) {
    console.error('[AXE NET] notices load failed:', error);
    store.updateState((state) => ({
      ...state,
      notice: {
        ...state.notice,
        initialized: true,
        loading: false,
        error: formatNoticeError(error),
      },
    }));
  }
}

function setEditorSaving(saving, error) {
  store.updateState((state) => ({
    ...state,
    notice: {
      ...state.notice,
      editor: {
        ...state.notice.editor,
        saving,
        error,
      },
    },
  }));
}

function closeEditorState() {
  return {
    open: false,
    kind: 'notice',
    itemId: null,
    saving: false,
    error: null,
  };
}

function validateEditor(kind, values) {
  const title = String(values.title || '').trim();
  const content = String(values.content || '').trim();

  if (!title) throw new Error(kind === 'operation' ? '운영기준 제목을 입력하세요.' : '공지 제목을 입력하세요.');
  if (!content) throw new Error(kind === 'operation' ? '운영기준 내용을 입력하세요.' : '공지 내용을 입력하세요.');

  if (kind === 'operation') {
    if (!String(values.category || '').trim()) throw new Error('운영기준 분류를 입력하세요.');
    const sortOrder = Number(values.sort_order ?? 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new Error('정렬 순서는 0 이상의 정수로 입력하세요.');
  }
}

function formatNoticeError(error) {
  const message = error?.message ?? String(error);
  if (message.includes('관리자 권한')) return '관리자 권한이 필요합니다.';
  if (message.includes('relation') && message.includes('does not exist')) {
    return '공지 데이터베이스가 아직 준비되지 않았습니다. 021_notice_operations.sql을 먼저 적용하세요.';
  }
  return message;
}
