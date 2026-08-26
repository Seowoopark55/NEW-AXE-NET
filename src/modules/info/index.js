import { store } from '../../state/store.js';
import {
  fetchMemberModbookRequests,
  submitMemberModbookRequest,
  updateMemberModbookPrice,
  fetchMemberPresetFavorites,
  toggleMemberPresetFavorite,
  saveMemberPresetPost,
  deleteMemberPresetPost,
} from '../auth/memberAuthService.js';
import {
  deactivateModbook,
  fetchInfoData,
  fetchPresetCommunity,
  fetchModbookRequests,
  reviewModbookRequest,
  saveModbook,
  updateModbookPrice,
} from './infoService.js';
import { renderInfoView } from './infoView.js';

const TABS = new Set(['craft', 'quest', 'process', 'modbook', 'preset', 'skill']);

export async function initInfoModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  const rerender = () => {
    if (store.getState().ui.activeModule !== 'info') return;

    renderInfoView(root, store.getState(), {
      onTabChange(tab) {
        const nextTab = TABS.has(tab) ? tab : 'craft';
        store.updateState((state) => ({
          ...state,
          info: {
            ...state.info,
            tab: nextTab,
          },
        }));
        if (nextTab === 'preset' && store.getState().auth.member) void loadPresetFavorites();
      },

      onFilterChange(key, value) {
        if (!(key in store.getState().info.filters)) return;
        store.updateState((state) => ({
          ...state,
          info: {
            ...state.info,
            filters: {
              ...state.info.filters,
              [key]: value,
            },
          },
        }));
      },

      onSelectCraft(id) {
        store.updateState((state) => ({ ...state, info: { ...state.info, selectedCraftId: id } }));
      },

      onSelectModbook(id) {
        store.updateState((state) => ({ ...state, info: { ...state.info, selectedModbookId: Number(id) } }));
      },

      onSelectModbookPreset(id) {
        const nextId = Number(id);
        if (!Number.isInteger(nextId) || nextId <= 0) return;
        store.updateState((state) => ({
          ...state,
          info: {
            ...state.info,
            selectedModbookPresetId: nextId,
            selectedModbookPresetSlot: 'bottom',
          },
        }));
      },

      onPresetFilterChange(filter) {
        const next = filter === 'favorites' ? 'favorites' : 'all';
        store.updateState((state) => ({
          ...state,
          info: { ...state.info, presetFilter: next },
        }));
        if (next === 'favorites' && store.getState().auth.member) void loadPresetFavorites();
      },

      onPresetSearchChange(value) {
        store.updateState((state) => ({
          ...state,
          info: { ...state.info, presetSearch: String(value || '') },
        }));
      },

      onOpenPresetEditor(postId = null, clone = false) {
        const auth = store.getState().auth;
        if (!auth.member) {
          window.alert('추천세팅 작성은 멤버 로그인 후 이용할 수 있습니다.');
          return;
        }
        const id = postId == null ? null : Number(postId);
        store.updateState((state) => ({
          ...state,
          info: {
            ...state.info,
            presetEditor: {
              open: true,
              postId: clone ? null : (Number.isInteger(id) ? id : null),
              cloneFromId: clone && Number.isInteger(id) ? id : null,
              saving: false,
              error: null,
            },
          },
        }));
      },

      async onSavePresetPost(values) {
        await savePresetPost(values);
      },

      async onDeletePresetPost(postId) {
        await deletePresetPost(postId);
      },

      async onTogglePresetFavorite(postId) {
        await togglePresetFavorite(postId);
      },

      onSelectModbookPresetSlot(slot) {
        store.updateState((state) => ({
          ...state,
          info: {
            ...state.info,
            selectedModbookPresetSlot: String(slot || 'bottom'),
          },
        }));
      },

      async onRefresh() {
        await reloadInfoData({ preserveSelection: true });
        if (store.getState().auth.member) await loadPresetFavorites({ silent: true });
        if (store.getState().auth.admin) await loadAdminRequests({ silent: true });
      },

      async onOpenRequest() {
        store.updateState((state) => ({
          ...state,
          info: {
            ...state.info,
            modbookRequest: {
              ...state.info.modbookRequest,
              open: true,
              error: null,
              message: null,
            },
          },
        }));
        if (store.getState().auth.member) await loadMyRequests();
      },

      async onLoadMyRequests() {
        await loadMyRequests();
      },

      async onSubmitRequest(values) {
        await submitRequest(values);
      },

      async onOpenAdminRequests() {
        if (!store.getState().auth.admin) return;
        store.updateState((state) => ({
          ...state,
          info: {
            ...state.info,
            admin: { ...state.info.admin, requestsOpen: true, error: null },
          },
        }));
        await loadAdminRequests();
      },

      async onReviewRequest(id, action, note) {
        if (!store.getState().auth.admin) return;
        if (action === 'reject' && !String(note || '').trim()) {
          window.alert('반려 사유를 입력하세요.');
          return;
        }
        setAdminSaving(true);
        try {
          await reviewModbookRequest(id, action, note);
          await Promise.all([reloadInfoData({ preserveSelection: true }), loadAdminRequests({ silent: true })]);
        } catch (error) {
          setAdminError(formatInfoError(error));
        } finally {
          setAdminSaving(false);
        }
      },

      onOpenEditor(id) {
        if (!store.getState().auth.admin) return;
        store.updateState((state) => ({
          ...state,
          info: {
            ...state.info,
            admin: {
              ...state.info.admin,
              editorOpen: true,
              editorId: id ? Number(id) : null,
              error: null,
            },
          },
        }));
      },

      async onSaveModbook(values) {
        if (!store.getState().auth.admin) return;
        const validation = validateModbook(values);
        if (validation) {
          window.alert(validation);
          return;
        }
        setAdminSaving(true);
        try {
          const id = await saveModbook(values);
          await reloadInfoData({ preserveSelection: false });
          store.updateState((state) => ({
            ...state,
            info: {
              ...state.info,
              tab: 'modbook',
              selectedModbookId: Number(id),
              admin: { ...state.info.admin, editorOpen: false, editorId: null, saving: false, error: null },
            },
          }));
        } catch (error) {
          setAdminError(formatInfoError(error));
        } finally {
          setAdminSaving(false);
        }
      },

      async onDeactivate(id) {
        if (!store.getState().auth.admin) return;
        if (!window.confirm('이 개조서를 정식 목록에서 내릴까요?')) return;
        setAdminSaving(true);
        try {
          await deactivateModbook(id);
          await reloadInfoData({ preserveSelection: false });
        } catch (error) {
          window.alert(formatInfoError(error));
        } finally {
          setAdminSaving(false);
        }
      },

      onOpenPrice(id) {
        const auth = store.getState().auth;
        if (!auth.member && !auth.admin) {
          window.alert('최근 거래가 설정은 로그인 후 이용할 수 있습니다.');
          return;
        }
        store.updateState((state) => ({
          ...state,
          info: {
            ...state.info,
            admin: { ...state.info.admin, priceOpen: true, priceId: Number(id), error: null },
          },
        }));
      },

      async onSavePrice(values) {
        const auth = store.getState().auth;
        if (!auth.member && !auth.admin) return;
        const raw = String(values.recent_price ?? '').trim().replace(/,/g, '');
        if (raw && (!/^\d+$/.test(raw) || Number(raw) < 0)) {
          window.alert('거래가격은 0 이상의 정수로 입력하세요.');
          return;
        }
        setAdminSaving(true);
        try {
          if (auth.member) {
            await updateMemberModbookPrice(Number(values.id), raw);
          } else {
            await updateModbookPrice(Number(values.id), raw, auth.admin?.nickname || '');
          }
          await reloadInfoData({ preserveSelection: true });
          store.updateState((state) => ({
            ...state,
            info: {
              ...state.info,
              admin: { ...state.info.admin, priceOpen: false, priceId: null, saving: false, error: null },
            },
          }));
        } catch (error) {
          window.alert(formatInfoError(error));
        } finally {
          setAdminSaving(false);
        }
      },

      onCloseModal(kind) {
        closeModal(kind);
      },
    });
  };

  rerender();
  store.subscribe(rerender);
  await reloadInfoData({ preserveSelection: true });
  if (store.getState().auth.member) await loadPresetFavorites({ silent: true });
  if (store.getState().auth.admin) await loadAdminRequests({ silent: true });
}

async function reloadInfoData(options = {}) {
  store.updateState((state) => ({
    ...state,
    info: { ...state.info, loading: true, error: null },
  }));

  try {
    const data = await fetchInfoData();
    store.updateState((state) => ({
      ...state,
      info: {
        ...state.info,
        ...data,
        initialized: true,
        loading: false,
        error: null,
        selectedCraftId: options.preserveSelection ? state.info.selectedCraftId : null,
        selectedModbookId: options.preserveSelection ? state.info.selectedModbookId : null,
        selectedModbookPresetId: resolvePresetSelection(
          data.presetPosts,
          options.preserveSelection ? state.info.selectedModbookPresetId : null,
        ),
      },
    }));
  } catch (error) {
    console.error('[AXE NET] info load failed:', error);
    store.updateState((state) => ({
      ...state,
      info: { ...state.info, initialized: true, loading: false, error: formatInfoError(error) },
    }));
  }
}


function resolvePresetSelection(posts, currentId) {
  const list = Array.isArray(posts) ? posts : [];
  const current = Number(currentId);
  if (Number.isInteger(current) && list.some((post) => Number(post.id) === current)) return current;
  return list.length ? Number(list[0].id) : null;
}

async function refreshPresetCommunity(options = {}) {
  try {
    const data = await fetchPresetCommunity();
    store.updateState((state) => ({
      ...state,
      info: {
        ...state.info,
        presetCommunityReady: data.ready,
        presetPosts: data.posts,
        selectedModbookPresetId: resolvePresetSelection(
          data.posts,
          options.selectId ?? state.info.selectedModbookPresetId,
        ),
      },
    }));
  } catch (error) {
    console.error('[AXE NET] preset community refresh failed:', error);
    throw error;
  }
}

async function loadPresetFavorites(options = {}) {
  const member = store.getState().auth.member;
  if (!member) {
    store.updateState((state) => ({
      ...state,
      info: { ...state.info, presetFavorites: [], presetFavoritesMemberKey: null },
    }));
    return;
  }
  try {
    const ids = await fetchMemberPresetFavorites();
    store.updateState((state) => ({
      ...state,
      info: {
        ...state.info,
        presetFavorites: ids,
        presetFavoritesMemberKey: member.member_key,
      },
    }));
  } catch (error) {
    if (!options.silent) window.alert(formatInfoError(error));
  }
}

async function togglePresetFavorite(postId) {
  if (!store.getState().auth.member) {
    window.alert('내 프리셋 저장은 멤버 로그인 후 이용할 수 있습니다.');
    return;
  }
  const id = Number(postId);
  if (!Number.isInteger(id) || id <= 0) return;
  try {
    const result = await toggleMemberPresetFavorite(id);
    store.updateState((state) => {
      const favorites = new Set((state.info.presetFavorites || []).map(Number));
      if (result.favorite) favorites.add(id);
      else favorites.delete(id);
      return {
        ...state,
        info: {
          ...state.info,
          presetFavorites: [...favorites],
          presetPosts: state.info.presetPosts.map((post) => (
            Number(post.id) === id ? { ...post, favorite_count: result.favorite_count } : post
          )),
        },
      };
    });
  } catch (error) {
    window.alert(formatInfoError(error));
  }
}

function parsePresetTags(value) {
  return [...new Set(String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean))]
    .slice(0, 8);
}

function buildPresetSlots(values) {
  return ['outer', 'top', 'bottom', 'shoes'].map((slotKey) => ({
    slot_key: slotKey,
    prefix_modbook_id: values[`${slotKey}_prefix_id`] || null,
    suffix_modbook_id: values[`${slotKey}_suffix_id`] || null,
    note: values[`${slotKey}_note`] || '',
  }));
}

async function savePresetPost(values) {
  const member = store.getState().auth.member;
  if (!member) return;
  const title = String(values.title || '').trim();
  const description = String(values.description || '').trim();
  if (!title) {
    setPresetEditorError('제목을 입력하세요.');
    return;
  }
  const slots = buildPresetSlots(values);
  if (!slots.some((slot) => slot.prefix_modbook_id || slot.suffix_modbook_id)) {
    setPresetEditorError('개조서를 하나 이상 선택하세요.');
    return;
  }

  const editor = store.getState().info.presetEditor;
  setPresetEditorSaving(true);
  try {
    const postId = await saveMemberPresetPost({
      id: editor.postId,
      title,
      description,
      tags: parsePresetTags(values.tags),
      slots,
    });
    await refreshPresetCommunity({ selectId: postId });
    await loadPresetFavorites({ silent: true });
    store.updateState((state) => ({
      ...state,
      info: {
        ...state.info,
        selectedModbookPresetId: postId,
        presetFilter: 'all',
        presetEditor: { open: false, postId: null, cloneFromId: null, saving: false, error: null },
      },
    }));
  } catch (error) {
    setPresetEditorError(formatInfoError(error));
  } finally {
    setPresetEditorSaving(false);
  }
}

async function deletePresetPost(postId) {
  if (!store.getState().auth.member) return;
  const id = Number(postId);
  if (!Number.isInteger(id) || id <= 0) return;
  if (!window.confirm('이 추천세팅 게시글을 삭제할까요?')) return;
  try {
    await deleteMemberPresetPost(id);
    await refreshPresetCommunity();
    await loadPresetFavorites({ silent: true });
  } catch (error) {
    window.alert(formatInfoError(error));
  }
}

function setPresetEditorSaving(saving) {
  store.updateState((state) => ({
    ...state,
    info: {
      ...state.info,
      presetEditor: { ...state.info.presetEditor, saving },
    },
  }));
}

function setPresetEditorError(error) {
  store.updateState((state) => ({
    ...state,
    info: {
      ...state.info,
      presetEditor: { ...state.info.presetEditor, saving: false, error },
    },
  }));
}

async function loadMyRequests() {
  if (!store.getState().auth.member) return;
  store.updateState((state) => ({
    ...state,
    info: {
      ...state.info,
      modbookRequest: { ...state.info.modbookRequest, loading: true, error: null },
    },
  }));
  try {
    const requests = await fetchMemberModbookRequests();
    store.updateState((state) => ({
      ...state,
      info: {
        ...state.info,
        modbookRequest: { ...state.info.modbookRequest, loading: false, myRequests: requests, error: null },
      },
    }));
  } catch (error) {
    store.updateState((state) => ({
      ...state,
      info: {
        ...state.info,
        modbookRequest: { ...state.info.modbookRequest, loading: false, error: formatInfoError(error) },
      },
    }));
  }
}

async function submitRequest(values) {
  if (!store.getState().auth.member) return;
  const validation = validateModbook(values, { request: true });
  if (validation) {
    store.updateState((state) => ({
      ...state,
      info: { ...state.info, modbookRequest: { ...state.info.modbookRequest, error: validation } },
    }));
    return;
  }

  store.updateState((state) => ({
    ...state,
    info: {
      ...state.info,
      modbookRequest: { ...state.info.modbookRequest, saving: true, error: null, message: null },
    },
  }));

  try {
    await submitMemberModbookRequest(values);
    store.updateState((state) => ({
      ...state,
      info: {
        ...state.info,
        modbookRequest: { ...state.info.modbookRequest, saving: false, message: '개조서 등록신청을 접수했습니다.', error: null },
      },
    }));
    await loadMyRequests();
    if (store.getState().auth.admin) await loadAdminRequests({ silent: true });
  } catch (error) {
    store.updateState((state) => ({
      ...state,
      info: {
        ...state.info,
        modbookRequest: { ...state.info.modbookRequest, saving: false, error: formatInfoError(error) },
      },
    }));
  }
}

async function loadAdminRequests(options = {}) {
  if (!store.getState().auth.admin) return;
  if (!options.silent) {
    store.updateState((state) => ({
      ...state,
      info: { ...state.info, admin: { ...state.info.admin, loading: true, error: null } },
    }));
  }
  try {
    const requests = await fetchModbookRequests();
    store.updateState((state) => ({
      ...state,
      info: { ...state.info, admin: { ...state.info.admin, loading: false, requests, error: null } },
    }));
  } catch (error) {
    if (!options.silent) setAdminError(formatInfoError(error));
  }
}

function closeModal(kind) {
  store.updateState((state) => {
    const info = state.info;
    if (kind === 'request') {
      return { ...state, info: { ...info, modbookRequest: { ...info.modbookRequest, open: false, error: null, message: null } } };
    }
    if (kind === 'adminRequests') {
      return { ...state, info: { ...info, admin: { ...info.admin, requestsOpen: false, error: null } } };
    }
    if (kind === 'editor') {
      return { ...state, info: { ...info, admin: { ...info.admin, editorOpen: false, editorId: null, error: null } } };
    }
    if (kind === 'price') {
      return { ...state, info: { ...info, admin: { ...info.admin, priceOpen: false, priceId: null, error: null } } };
    }
    if (kind === 'presetEditor') {
      return {
        ...state,
        info: {
          ...info,
          presetEditor: { open: false, postId: null, cloneFromId: null, saving: false, error: null },
        },
      };
    }
    return state;
  });
}

function setAdminSaving(saving) {
  store.updateState((state) => ({
    ...state,
    info: { ...state.info, admin: { ...state.info.admin, saving } },
  }));
}

function setAdminError(error) {
  store.updateState((state) => ({
    ...state,
    info: { ...state.info, admin: { ...state.info.admin, loading: false, saving: false, error } },
  }));
}

function validateModbook(values, options = {}) {
  if (!['접두', '접미'].includes(String(values.type || '').trim())) return '개조 위치를 선택하세요.';
  if (!String(values.category || '').trim()) return '분류를 입력하세요.';
  if (!String(values.name || '').trim()) return '개조서 이름을 입력하세요.';
  if (!String(values.parts || '').trim()) return '적용 부위를 입력하세요.';
  if (options.request && ![values.option1, values.option2, values.option3].some((value) => String(value || '').trim())) return '개조 옵션을 하나 이상 입력하세요.';
  const rate = String(values.success_rate ?? '').trim();
  if (rate && (!/^\d+$/.test(rate) || Number(rate) < 0 || Number(rate) > 100)) return '성공률은 0~100 사이 정수로 입력하세요.';
  return null;
}

function formatInfoError(error) {
  const message = error?.message ?? String(error);
  if (message.includes('info_preset_posts') || message.includes('save_info_preset_post')) return '추천세팅 게시판 DB가 아직 준비되지 않았습니다. 047_modbook_preset_community.sql을 적용하세요.';
  if (message.includes('relation') && message.includes('does not exist')) return '정보 데이터베이스가 아직 준비되지 않았습니다. 관련 Supabase SQL을 먼저 적용하세요.';
  if (message.includes('JWT') || message.includes('관리자 권한')) return '관리자 권한이 필요합니다.';
  return message;
}
