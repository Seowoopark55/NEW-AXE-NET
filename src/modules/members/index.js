import { store } from '../../state/store.js';
import {
  createMember,
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
    if (store.getState().ui.activeModule !== 'members') {
      return;
    }

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

        if (isSuperAdmin()) {
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
        if (!isSuperAdmin()) return;

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
        if (!isSuperAdmin()) return;

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
              saveError: formatMemberError(error),
              saveSuccess: null,
            },
          }));
        }
      },

      onOpenCreate() {
        if (!isSuperAdmin()) return;

        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            create: {
              open: true,
              creating: false,
              error: null,
            },
          },
        }));
      },

      onCloseCreate() {
        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            create: {
              open: false,
              creating: false,
              error: null,
            },
          },
        }));
      },

      async onCreateMember(values) {
        if (!isSuperAdmin()) return;

        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            create: {
              ...state.members.create,
              creating: true,
              error: null,
            },
          },
        }));

        try {
          validateCreateValues(values);
          const memberKey = await createMember(values);
          const items = await fetchMembers();

          store.updateState((state) => ({
            ...state,
            members: {
              ...state.members,
              items,
              filter: 'all',
              search: '',
              selectedMemberKey: memberKey,
              editingMemberKey: null,
              saveError: null,
              saveSuccess: '신규 멤버가 등록되었습니다.',
              create: {
                open: false,
                creating: false,
                error: null,
              },
              audit: {
                memberKey,
                items: [],
                loading: false,
                error: null,
              },
            },
          }));

          await loadMemberAudit(memberKey);
        } catch (error) {
          console.error('[NEW AXE NET] member create failed:', error);

          store.updateState((state) => ({
            ...state,
            members: {
              ...state.members,
              create: {
                ...state.members.create,
                creating: false,
                error: formatMemberError(error),
              },
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
  if (!isSuperAdmin()) return;

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
          error: formatMemberError(error),
        },
      },
    }));
  }
}

function isSuperAdmin() {
  return store.getState().auth.admin?.admin_level === 'superadmin';
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

function validateCreateValues(values) {
  validateMemberValues({
    ...values,
    status: values.status,
  });

  if (!['active', 'inactive'].includes(values.status)) {
    throw new Error('신규 멤버는 활동 또는 비활성 상태로만 등록할 수 있습니다.');
  }

  const discordUserId = String(values.discord_user_id ?? '').trim();

  if (discordUserId && !/^\d+$/.test(discordUserId)) {
    throw new Error('Discord 사용자 ID는 숫자만 입력하세요.');
  }

  if (!values.joined_date) {
    throw new Error('가입일을 입력하세요.');
  }
}

function formatMemberError(error) {
  const message = error?.message ?? String(error);

  if (message.includes('members_discord_user_id_key')) {
    return '이미 등록된 Discord 사용자 ID입니다.';
  }

  if (message.includes('duplicate key value')) {
    return '이미 존재하는 값이 있어 저장할 수 없습니다.';
  }

  if (message.includes('관리자 권한')) {
    return '관리자 권한이 필요합니다.';
  }

  return message;
}
