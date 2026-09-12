import { api } from '../../api/api.js';

export async function fetchAdminAssetData() {
  const [assets, returns, accounts, requests] = await Promise.all([
    api.select('company_assets', {
      columns: 'id,legacy_no,member_key,owner_name,asset_category,asset_name,acquisition_method,acquired_at,personal_cost,status,note,active,sort_order,created_at,updated_at',
      orderBy: 'sort_order',
      ascending: true,
      limit: 1000,
    }),
    api.select('company_asset_returns', {
      columns: 'id,legacy_no,asset_id,member_key,owner_name,asset_name,returned,checker,processed_at,note,active,created_at,updated_at',
      orderBy: 'created_at',
      ascending: false,
      limit: 1000,
    }),
    api.select('member_accounts', {
      columns: 'id,member_key,account,enabled,note,sort_order,created_at,updated_at',
      orderBy: 'sort_order',
      ascending: true,
      limit: 1000,
    }),
    api.select('member_account_requests', {
      columns: 'id,member_key,nickname,account,note,status,reviewer,review_note,reviewed_at,created_at,updated_at',
      orderBy: 'created_at',
      ascending: false,
      limit: 300,
    }),
  ]);

  return {
    assets: assets.filter((item) => item.active !== false),
    returns: returns.filter((item) => item.active !== false),
    accounts,
    requests,
  };
}

export async function saveCompanyAsset(values) {
  return api.rpc('save_company_asset', {
    p_id: values.id || null,
    p_legacy_no: textOrNull(values.legacy_no),
    p_member_key: textOrNull(values.member_key),
    p_owner_name: String(values.owner_name || '').trim(),
    p_asset_category: String(values.asset_category || '').trim(),
    p_asset_name: String(values.asset_name || '').trim(),
    p_acquisition_method: textOrNull(values.acquisition_method),
    p_acquired_at: textOrNull(values.acquired_at),
    p_personal_cost: nullableInteger(values.personal_cost),
    p_status: String(values.status || '보유').trim(),
    p_note: textOrNull(values.note),
  });
}

export async function deactivateCompanyAsset(id) {
  return api.rpc('deactivate_company_asset', { p_id: Number(id) });
}

export async function saveCompanyAssetReturn(values) {
  return api.rpc('save_company_asset_return', {
    p_id: values.id || null,
    p_legacy_no: textOrNull(values.legacy_no),
    p_asset_id: nullableInteger(values.asset_id),
    p_member_key: textOrNull(values.member_key),
    p_owner_name: String(values.owner_name || '').trim(),
    p_asset_name: String(values.asset_name || '').trim(),
    p_returned: Boolean(values.returned),
    p_checker: textOrNull(values.checker),
    p_processed_at: textOrNull(values.processed_at),
    p_note: textOrNull(values.note),
  });
}

export async function deactivateCompanyAssetReturn(id) {
  return api.rpc('deactivate_company_asset_return', { p_id: Number(id) });
}

export async function saveMemberAccount(values) {
  return api.rpc('save_member_account', {
    p_member_key: String(values.member_key || '').trim(),
    p_account: String(values.account || '').trim(),
    p_enabled: values.enabled !== false,
    p_note: textOrNull(values.note),
  });
}

export async function deactivateMemberAccount(memberKey) {
  return api.rpc('deactivate_member_account', { p_member_key: String(memberKey || '').trim() });
}

export async function reviewMemberAccountRequest(id, action, reviewNote = '') {
  return api.rpc('review_member_account_request', {
    p_request_id: Number(id),
    p_action: action,
    p_review_note: textOrNull(reviewNote),
  });
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function nullableInteger(value) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (!text) return null;
  const number = Number(text);
  return Number.isInteger(number) ? number : null;
}
