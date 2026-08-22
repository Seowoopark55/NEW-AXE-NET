import { store } from '../../state/store.js';
import {
  fetchMemberAudit,
  fetchMembers,
  updateMember,
} from './membersService.js';
import { renderMembersView } from './membersView.js';

export async function initMembersModule() {
  const root = document.querySelector('#module-root');

  if (!root) {
    throw new Error('#module-root element not found.');
  }

  const rerender = () => {
    renderMembersView(root, store.getState(), {
      onFilterChange(filter) {
        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            filter,
          },
        }));
      },

      onSearchChange(search) {
        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            search,
          },
        }));
      },

      onSelectMember(memberKey) {
        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            selectedMemberKey: memberKey,
            editingMemberKey: null,
            saveError: null,
            saveSuccess: null,
            audit: {
              memberKey,
              items: [],
              loading: false,
              error: null,
            },
          },
        }));

        if (store.getState().auth.admin) {
          void loadMemberAudit(memberKey);
        }
      },

      onCloseDetail() {
        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            selectedMemberKey: null,
            editingMemberKey: null,
            saveError: null,
            saveSuccess: null,
            audit: {
              memberKey: null,
              items: [],
              loading: false,
              error: null,
            },
          },
        }));
      },

      onStartEdit(memberKey) {
        if (!store.getState().auth.admin) return;

        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            editingMemberKey: memberKey,
            saveError: null,
            saveSuccess: null,
          },
        }));
      },

      onCancelEdit() {
        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            editingMemberKey: null,
            saveError: null,
            saveSuccess: null,
          },
        }));
      },

      async onSaveMember(memberKey, values) {
        if (!store.getState().auth.admin) return;

        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            saving: true,
            saveError: null,
            saveSuccess: null,
          },
        }));

        try {
          validateMemberValues(values);
          await updateMember(memberKey, values);
          const items = await fetchMembers();

          store.updateState((state) => ({
            ...state,
            members: {
              ...state.members,
              items,
              saving: false,
              editingMemberKey: null,
              saveError: null,
              saveSuccess: '저장되었습니다.',
            },
          }));

          await loadMemberAudit(memberKey);
        } catch (error) {
          console.error('[NEW AXE NET] member update failed:', error);

          store.updateState((state) => ({
            ...state,
            members: {
              ...state.members,
              saving: false,
              saveError: error?.message ?? String(error),
              saveSuccess: null,
            },
          }));
        }
      },
    });
  };

  rerender();
  store.subscribe(rerender);

  store.updateState((state) => ({
    ...state,
    members: {
      ...state.members,
      loading: true,
      error: null,
    },
  }));

  try {
    const items = await fetchMembers();

    store.updateState((state) => ({
      ...state,
      members: {
        ...state.members,
        items,
        loading: false,
        error: null,
      },
    }));
  } catch (error) {
    console.error('[NEW AXE NET] members load failed:', error);

    store.updateState((state) => ({
      ...state,
      members: {
        ...state.members,
        loading: false,
        error: error?.message ?? String(error),
      },
    }));
  }
}

async function loadMemberAudit(memberKey) {
  if (!store.getState().auth.admin) return;

  store.updateState((state) => ({
    ...state,
    members: {
      ...state.members,
      audit: {
        memberKey,
        items: [],
        loading: true,
        error: null,
      },
    },
  }));

  try {
    const items = await fetchMemberAudit(memberKey);

    if (store.getState().members.selectedMemberKey !== memberKey) {
      return;
    }

    store.updateState((state) => ({
      ...state,
      members: {
        ...state.members,
        audit: {
          memberKey,
          items,
          loading: false,
          error: null,
        },
      },
    }));
  } catch (error) {
    console.error('[NEW AXE NET] member audit load failed:', error);

    if (store.getState().members.selectedMemberKey !== memberKey) {
      return;
    }

    store.updateState((state) => ({
      ...state,
      members: {
        ...state.members,
        audit: {
          memberKey,
          items: [],
          loading: false,
          error: error?.message ?? String(error),
        },
      },
    }));
  }
}

function validateMemberValues(values) {
  const nickname = String(values.nickname ?? '').trim();
  const points = Number(values.points);

  if (!nickname) {
    throw new Error('닉네임을 입력하세요.');
  }

  if (!['admin', 'user'].includes(values.role)) {
    throw new Error('올바르지 않은 권한 값입니다.');
  }

  if (!['active', 'inactive', 'resigned'].includes(values.status)) {
    throw new Error('올바르지 않은 상태 값입니다.');
  }

  if (!Number.isInteger(points) || points < 0) {
    throw new Error('포인트는 0 이상의 정수로 입력하세요.');
  }
}
