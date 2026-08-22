import { api } from '../../api/api.js';
import { fetchMemberFundProfile, submitMemberFundRequest } from '../auth/memberAuthService.js';

export async function fetchFundPeriods() {
  return api.rpc('get_fund_periods');
}

export async function fetchFundMonthOverview(year, month) {
  return api.rpc('get_fund_month_overview', {
    p_year: year,
    p_month: month,
  });
}

export async function fetchFundMonthMatrix(year, month) {
  return api.rpc('get_fund_month_matrix', {
    p_year: year,
    p_month: month,
  });
}

export async function fetchFundSummary(period = null) {
  return api.rpc('get_fund_summary', {
    p_year: period?.year ?? null,
    p_month: period?.month ?? null,
    p_week: period?.week ?? null,
  });
}

export async function fetchFundPeriodStatus(period) {
  return api.rpc('get_fund_period_status', {
    p_year: period.year,
    p_month: period.month,
    p_week: period.week,
  });
}

export async function fetchFundRecentLedger(limit = 12) {
  return api.rpc('get_fund_recent_ledger', {
    p_limit: limit,
  });
}

export async function fetchMyFundProfile(memberKey, discordUserId) {
  return api.rpc('get_my_fund_profile', {
    p_member_key: memberKey,
    p_discord_user_id: discordUserId,
  });
}

export async function submitFundRequest(values) {
  return api.rpc('submit_fund_request_v2', {
    p_member_key: values.member_key,
    p_discord_user_id: values.discord_user_id,
    p_year: values.year,
    p_month: values.month,
    p_week: values.week,
    p_amount: values.amount,
    p_payment_mode: values.payment_mode || '공용계좌',
    p_public_amount: values.public_amount || 0,
    p_company_amount: values.company_amount || 0,
    p_evidence_url: values.evidence_url || null,
    p_memo: values.memo || null,
    p_submitted_by_name: values.submitted_by_name || null,
    p_proxy_admin_name: values.proxy_admin_name || null,
    p_submitted_via: values.submitted_via || 'admin_web',
  });
}


export async function fetchSessionFundProfile() {
  return fetchMemberFundProfile();
}

export async function submitSessionFundRequest(values) {
  return submitMemberFundRequest(values);
}

async function fetchAdminMemberPrivate(memberKey) {
  const rows = await api.select('members', {
    columns: 'member_key,nickname,discord_user_id,discord_name,status',
    filters: { member_key: memberKey },
    limit: 1,
  });

  const member = rows?.[0] ?? null;
  if (!member) throw new Error('관리자 계정과 연결된 멤버를 찾을 수 없습니다.');
  if (member.status !== 'active') throw new Error('현재 활동 상태의 멤버만 공금 정보를 사용할 수 있습니다.');
  if (!member.discord_user_id) throw new Error('Discord 계정연동 정보가 없습니다.');
  return member;
}

export async function fetchAdminFundProfile(memberKey) {
  const member = await fetchAdminMemberPrivate(memberKey);
  const profile = await fetchMyFundProfile(member.member_key, member.discord_user_id);
  return hydrateAdminEvidenceProfile(profile);
}

export async function submitAdminFundRequest(values) {
  const member = await fetchAdminMemberPrivate(values.member_key);
  const evidence = values.evidence;
  if (!evidence?.dataUrl) throw new Error('증빙 스크린샷을 첨부하세요.');

  const blob = await fetch(evidence.dataUrl).then((response) => response.blob());
  const extension = evidenceExtension(evidence.type);
  const path = `${member.member_key}/${new Date().toISOString().slice(0, 7)}/${cryptoRandomId()}.${extension}`;
  await api.storageUpload('fund-evidence', path, blob, {
    contentType: evidence.type || blob.type || 'image/jpeg',
    cacheControl: '3600',
  });

  try {
    return await submitFundRequest({
      ...values,
      member_key: member.member_key,
      discord_user_id: member.discord_user_id,
      evidence_url: `storage://fund-evidence/${path}`,
      submitted_by_name: member.nickname,
      proxy_admin_name: values.proxy_admin_name || null,
      submitted_via: values.proxy_admin_name ? 'admin_proxy' : 'admin_web',
    });
  } catch (error) {
    await api.storageRemove('fund-evidence', [path]).catch(() => {});
    throw error;
  }
}

export async function fetchFundRequests(limit = 500) {
  const rows = await api.select('fund_requests', {
    columns: [
      'id',
      'discord_user_id',
      'discord_name',
      'member_key',
      'nickname',
      'year',
      'month',
      'week',
      'amount',
      'status',
      'evidence_url',
      'memo',
      'review_note',
      'reviewer_discord_name',
      'reviewed_at',
      'payment_mode',
      'public_amount',
      'company_amount',
      'submitted_via',
      'submitted_by_name',
      'proxy_admin_name',
      'created_at',
      'updated_at',
    ].join(','),
    orderBy: 'created_at',
    ascending: false,
    limit,
  });
  return Promise.all(rows.map(hydrateAdminEvidenceRow));
}

export async function approveFundRequest(requestId, reviewNote) {
  return api.rpc('approve_fund_request', {
    p_request_id: requestId,
    p_review_note: reviewNote || null,
  });
}

export async function rejectFundRequest(requestId, reviewNote) {
  return api.rpc('reject_fund_request', {
    p_request_id: requestId,
    p_review_note: reviewNote || null,
  });
}

export async function fetchFundAdminLedger(limit = 1000) {
  const rows = await api.select('fund_ledger', {
    columns: [
      'id',
      'member_key',
      'nickname',
      'year',
      'month',
      'week',
      'entry_type',
      'amount',
      'public_amount',
      'company_amount',
      'status',
      'memo',
      'ledger_date',
      'ledger_type',
      'category',
      'direction',
      'account',
      'approved_by_name',
      'request_id',
      'deleted_at',
      'deleted_by',
      'delete_reason',
      'evidence_url',
      'created_at',
      'updated_at',
    ].join(','),
    orderBy: 'ledger_date',
    ascending: false,
    limit,
  });
  return Promise.all(rows.map(hydrateAdminEvidenceRow));
}

export async function createFundPayment(values) {
  return withAdminEvidence(values.evidence, 'admin-ledger', async (evidenceUrl) => api.rpc('create_fund_payment_v2', {
    p_member_key: values.member_key,
    p_year: values.year,
    p_month: values.month,
    p_week: values.week,
    p_amount: values.amount,
    p_account: values.account,
    p_ledger_date: values.ledger_date || null,
    p_memo: values.memo || null,
    p_evidence_url: evidenceUrl,
  }));
}

export async function createFundTransaction(values) {
  return withAdminEvidence(values.evidence, 'admin-ledger', async (evidenceUrl) => api.rpc('create_fund_transaction_v2', {
    p_direction: values.direction,
    p_account: values.account,
    p_amount: values.amount,
    p_category: values.category,
    p_ledger_date: values.ledger_date || null,
    p_member_key: values.member_key || null,
    p_memo: values.memo || null,
    p_evidence_url: evidenceUrl,
  }));
}

export async function updateFundLedgerEntry(values) {
  return api.rpc('update_fund_ledger_entry', {
    p_ledger_id: values.ledger_id,
    p_amount: values.amount,
    p_account: values.account,
    p_ledger_date: values.ledger_date,
    p_direction: values.direction || null,
    p_category: values.category || null,
    p_member_key: values.member_key || null,
    p_memo: values.memo || null,
  });
}

export async function deleteFundLedgerEntry(ledgerId, reason) {
  return api.rpc('delete_fund_ledger_entry', {
    p_ledger_id: ledgerId,
    p_reason: reason || null,
  });
}

export async function restoreFundLedgerEntry(ledgerId) {
  return api.rpc('restore_fund_ledger_entry', {
    p_ledger_id: ledgerId,
  });
}

export async function fetchFundFeeRules() {
  return api.select('fund_fee_rules', {
    columns: [
      'id',
      'start_year',
      'start_month',
      'start_week',
      'weekly_fee',
      'note',
      'enabled',
      'source_key',
      'created_at',
      'updated_at',
    ].join(','),
    orderBy: 'id',
    ascending: false,
  });
}

export async function fetchFundExemptions(period) {
  return api.select('fund_exemptions', {
    columns: [
      'id',
      'member_key',
      'nickname',
      'year',
      'month',
      'week',
      'reason',
      'enabled',
      'created_by',
      'created_at',
    ].join(','),
    filters: {
      year: period.year,
      month: period.month,
      week: period.week,
      enabled: true,
    },
    orderBy: 'created_at',
    ascending: false,
  });
}

export async function createFundExemption(values) {
  return api.rpc('create_fund_exemption', {
    p_member_key: values.member_key,
    p_year: values.year,
    p_month: values.month,
    p_week: values.week,
    p_reason: values.reason || null,
  });
}

export async function disableFundExemption(exemptionId) {
  return api.rpc('disable_fund_exemption', {
    p_exemption_id: exemptionId,
  });
}

export async function createFundFeeRule(values) {
  return api.rpc('create_fund_fee_rule', {
    p_start_year: values.start_year,
    p_start_month: values.start_month,
    p_start_week: values.start_week,
    p_weekly_fee: values.weekly_fee,
    p_note: values.note || null,
  });
}

export async function setFundFeeRuleEnabled(ruleId, enabled) {
  return api.rpc('set_fund_fee_rule_enabled', {
    p_rule_id: ruleId,
    p_enabled: enabled,
  });
}

export async function fetchFundBalanceChecks(limit = 30) {
  const rows = await api.select('fund_balance_checks', {
    columns: [
      'id',
      'computed_public',
      'computed_company',
      'actual_public',
      'actual_company',
      'difference_public',
      'difference_company',
      'checked_by_name',
      'evidence_url',
      'note',
      'created_at',
    ].join(','),
    orderBy: 'created_at',
    ascending: false,
    limit,
  });
  return Promise.all(rows.map(hydrateAdminEvidenceRow));
}

export async function createFundBalanceCheck(values) {
  return withAdminEvidence(values.evidence, 'balance-checks', async (evidenceUrl) => api.rpc('create_fund_balance_check_v2', {
    p_actual_public: values.actual_public,
    p_actual_company: values.actual_company,
    p_evidence_url: evidenceUrl,
    p_note: values.note || null,
  }));
}

export async function fetchFundMemberSettings() {
  return api.select('fund_member_settings', {
    columns: 'member_key,enabled,join_date_override,note,updated_by,created_at,updated_at',
    orderBy: 'updated_at',
    ascending: false,
    limit: 1000,
  });
}

export async function setFundMemberSetting(values) {
  return api.rpc('set_fund_member_setting', {
    p_member_key: values.member_key,
    p_enabled: values.enabled,
    p_join_date_override: values.join_date_override || null,
    p_note: values.note || null,
  });
}

export async function fetchFundIntegrityReport() {
  return api.rpc('get_fund_integrity_report');
}


async function withAdminEvidence(evidence, folder, operation) {
  let path = null;
  let evidenceUrl = null;

  if (evidence?.dataUrl) {
    const blob = await fetch(evidence.dataUrl).then((response) => response.blob());
    const extension = evidenceExtension(evidence.type || blob.type);
    path = `${folder}/${new Date().toISOString().slice(0, 7)}/${cryptoRandomId()}.${extension}`;
    await api.storageUpload('fund-evidence', path, blob, {
      contentType: evidence.type || blob.type || 'image/jpeg',
      cacheControl: '3600',
    });
    evidenceUrl = `storage://fund-evidence/${path}`;
  }

  try {
    return await operation(evidenceUrl);
  } catch (error) {
    if (path) await api.storageRemove('fund-evidence', [path]).catch(() => {});
    throw error;
  }
}


async function hydrateAdminEvidenceProfile(profile) {
  if (!profile || !Array.isArray(profile.requests)) return profile;
  const requests = await Promise.all(profile.requests.map(hydrateAdminEvidenceRow));
  return { ...profile, requests };
}

async function hydrateAdminEvidenceRow(row) {
  const value = String(row?.evidence_url || '');
  const prefix = 'storage://fund-evidence/';
  if (!value.startsWith(prefix)) return row;
  const path = value.slice(prefix.length);
  try {
    const signed = await api.storageSignedUrl('fund-evidence', path, 3600);
    return { ...row, evidence_storage_ref: value, evidence_url: signed || null };
  } catch {
    return { ...row, evidence_storage_ref: value, evidence_url: null };
  }
}

function evidenceExtension(mime) {
  const value = String(mime || '').toLowerCase();
  if (value.includes('png')) return 'png';
  if (value.includes('webp')) return 'webp';
  if (value.includes('gif')) return 'gif';
  if (value.includes('heic')) return 'heic';
  if (value.includes('heif')) return 'heif';
  return 'jpg';
}

function cryptoRandomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
