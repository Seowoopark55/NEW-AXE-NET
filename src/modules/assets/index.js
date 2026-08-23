import { store } from '../../state/store.js';
import {
  fetchMemberAccounts,
  fetchMemberAccountRequests,
  submitMemberAccountRequest,
} from '../auth/memberAuthService.js';
import {
  deactivateCompanyAsset,
  deactivateCompanyAssetReturn,
  deactivateMemberAccount,
  fetchAdminAssetData,
  reviewMemberAccountRequest,
  saveCompanyAsset,
  saveCompanyAssetReturn,
  saveMemberAccount,
} from './assetsService.js';
import { renderAssetsView } from './assetsView.js';

const TABS = new Set(['accounts', 'company', 'returns']);
let reloadPromise = null;

export async function initAssetsModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  let lastIdentity = identityKey(store.getState());

  const rerender = (state) => {
    if (state.ui.activeModule === 'assets') {
      renderAssetsView(root, state, actions);
    }

    const nextIdentity = identityKey(state);
    if (nextIdentity !== lastIdentity) {
      lastIdentity = nextIdentity;
      queueMicrotask(() => reloadAssetsData({ silent: true }));
    }
  };

  const actions = {
    onTabChange(tab) {
      const isAdmin = Boolean(store.getState().auth.admin);
      const nextTab = TABS.has(tab) ? tab : 'accounts';
      if (nextTab !== 'accounts' && !isAdmin) return;
      updateAssets((asset) => ({ ...asset, tab: nextTab, error: null, message: null }));
    },

    onFilterChange(key, value) {
      if (!(key in store.getState().assets.filters)) return;
      updateAssets((asset) => ({
        ...asset,
        filters: { ...asset.filters, [key]: value },
      }));
    },

    async onRefresh() {
      await reloadAssetsData();
    },

    onOpenLogin() {
      store.updateState((state) => ({
        ...state,
        auth: { ...state.auth, loginOpen: true, loginMode: 'member', error: null },
      }));
    },

    async onCopy(value) {
      try {
        await copyText(value);
        setMessage('계좌번호를 복사했습니다.');
      } catch {
        window.prompt('계좌번호를 복사하세요.', String(value || ''));
      }
    },

    onOpenModal(type, itemId = null) {
      const state = store.getState();
      if (type === 'member-request' && !state.auth.member) {
        actions.onOpenLogin();
        return;
      }
      if (['account', 'asset', 'return'].includes(type) && !state.auth.admin) return;
      updateAssets((asset) => ({
        ...asset,
        modal: { type, itemId, saving: false, error: null },
      }));
    },

    onCloseModal() {
      closeModal();
    },

    async onSubmitModal(type, values) {
      setModalSaving(true, null);
      try {
        if (type === 'member-request') {
          await submitMemberAccountRequest(values);
          setMessage('플리카 계좌 신청이 접수되었습니다.');
        } else if (type === 'account') {
          requireAdmin();
          validateAccount(values);
          await saveMemberAccount(values);
          setMessage('플리카 계좌를 저장했습니다.');
        } else if (type === 'asset') {
          requireAdmin();
          validateAsset(values);
          await saveCompanyAsset(values);
          setMessage('회사 자산 정보를 저장했습니다.');
        } else if (type === 'return') {
          requireAdmin();
          validateReturn(values);
          await saveCompanyAssetReturn(values);
          setMessage('반납 내역을 저장했습니다.');
        } else {
          throw new Error('지원하지 않는 저장 작업입니다.');
        }
        closeModal();
        await reloadAssetsData({ preserveMessage: true });
      } catch (error) {
        console.error('[NEW AXE NET] asset modal save failed:', error);
        setModalSaving(false, formatAssetError(error));
      }
    },

    async onReviewRequest(id, action) {
      requireAdmin();
      let note = '';
      if (action === 'approve') {
        if (!window.confirm('이 플리카 계좌 신청을 승인할까요?')) return;
      } else {
        note = window.prompt('반려 사유를 입력하세요. (선택)', '') ?? '';
        if (!window.confirm('이 신청을 반려할까요?')) return;
      }
      try {
        await reviewMemberAccountRequest(id, action, note);
        setMessage(action === 'approve' ? '계좌 신청을 승인했습니다.' : '계좌 신청을 반려했습니다.');
        await reloadAssetsData({ preserveMessage: true });
      } catch (error) {
        window.alert(formatAssetError(error));
      }
    },

    async onDeactivateAccount(memberKey) {
      requireAdmin();
      if (!window.confirm('이 플리카 계좌를 사용중지할까요?')) return;
      try {
        await deactivateMemberAccount(memberKey);
        closeModal();
        setMessage('플리카 계좌를 사용중지했습니다.');
        await reloadAssetsData({ preserveMessage: true });
      } catch (error) {
        window.alert(formatAssetError(error));
      }
    },

    async onDeactivateAsset(id) {
      requireAdmin();
      if (!window.confirm('이 회사 자산을 목록에서 내릴까요?')) return;
      try {
        await deactivateCompanyAsset(id);
        closeModal();
        setMessage('회사 자산을 목록에서 내렸습니다.');
        await reloadAssetsData({ preserveMessage: true });
      } catch (error) {
        window.alert(formatAssetError(error));
      }
    },

    async onDeactivateReturn(id) {
      requireAdmin();
      if (!window.confirm('이 반납 기록을 목록에서 내릴까요?')) return;
      try {
        await deactivateCompanyAssetReturn(id);
        closeModal();
        setMessage('반납 기록을 목록에서 내렸습니다.');
        await reloadAssetsData({ preserveMessage: true });
      } catch (error) {
        window.alert(formatAssetError(error));
      }
    },
  };

  rerender(store.getState());
  store.subscribe(rerender);
  await reloadAssetsData({ silent: true });
}

async function reloadAssetsData(options = {}) {
  if (reloadPromise) return reloadPromise;

  reloadPromise = (async () => {
    const current = store.getState();
    const isAdmin = Boolean(current.auth.admin);
    const isMember = Boolean(current.auth.member);

    updateAssets((asset) => ({
      ...asset,
      loading: !options.silent,
      error: null,
      message: options.preserveMessage ? asset.message : null,
    }));

    try {
      let companyAssets = [];
      let returns = [];
      let accounts = [];
      let adminRequests = [];
      let ownRequests = [];

      if (isAdmin) {
        const adminData = await fetchAdminAssetData();
        companyAssets = adminData.assets;
        returns = adminData.returns;
        accounts = adminData.accounts;
        adminRequests = adminData.requests;
      } else if (isMember) {
        accounts = await fetchMemberAccounts();
      }

      if (isMember) {
        ownRequests = await fetchMemberAccountRequests();
      }

      updateAssets((asset) => ({
        ...asset,
        initialized: true,
        loading: false,
        error: null,
        companyAssets,
        returns,
        accounts,
        adminRequests,
        ownRequests,
        tab: asset.tab !== 'accounts' && !isAdmin ? 'accounts' : asset.tab,
      }));
    } catch (error) {
      console.error('[NEW AXE NET] asset data load failed:', error);
      updateAssets((asset) => ({
        ...asset,
        initialized: true,
        loading: false,
        error: formatAssetError(error),
      }));
    }
  })().finally(() => {
    reloadPromise = null;
  });

  return reloadPromise;
}

function updateAssets(updater) {
  store.updateState((state) => ({
    ...state,
    assets: updater(state.assets),
  }));
}

function closeModal() {
  updateAssets((asset) => ({
    ...asset,
    modal: { type: null, itemId: null, saving: false, error: null },
  }));
}

function setModalSaving(saving, error) {
  updateAssets((asset) => ({
    ...asset,
    modal: { ...asset.modal, saving, error },
  }));
}

function setMessage(message) {
  updateAssets((asset) => ({ ...asset, message }));
  window.setTimeout(() => {
    const current = store.getState().assets.message;
    if (current === message) updateAssets((asset) => ({ ...asset, message: null }));
  }, 2200);
}

function requireAdmin() {
  if (!store.getState().auth.admin) throw new Error('관리자 권한이 필요합니다.');
}

function validateAccount(values) {
  if (!String(values.member_key || '').trim()) throw new Error('멤버를 선택하세요.');
  if (!String(values.account || '').trim()) throw new Error('계좌번호를 입력하세요.');
}

function validateAsset(values) {
  if (!String(values.owner_name || '').trim()) throw new Error('보유자를 입력하세요.');
  if (!String(values.asset_name || '').trim()) throw new Error('자산명을 입력하세요.');
  const cost = String(values.personal_cost ?? '').trim();
  if (cost && (!Number.isInteger(Number(cost)) || Number(cost) < 0)) throw new Error('개인 부담 비용은 0 이상의 정수로 입력하세요.');
}

function validateReturn(values) {
  if (!String(values.owner_name || '').trim()) throw new Error('이름을 입력하세요.');
  if (!String(values.asset_name || '').trim()) throw new Error('자산명을 입력하세요.');
}

function identityKey(state) {
  return `${state.auth.member?.member_key || '-'}|${state.auth.admin?.user_id || state.auth.user?.id || '-'}`;
}

function formatAssetError(error) {
  const message = String(error?.message || error || '오류가 발생했습니다.');
  const lower = message.toLowerCase();
  if (message.includes('관리자 권한')) return '관리자 권한이 필요합니다.';
  if (message.includes('026_assets_plika.sql')) return message;
  if (lower.includes('relation') && (lower.includes('member_accounts') || lower.includes('company_assets'))) {
    return '자산·계좌 데이터베이스가 아직 준비되지 않았습니다. 026_assets_plika.sql을 먼저 적용하세요.';
  }
  return message;
}

async function copyText(value) {
  const text = String(value || '');
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}
