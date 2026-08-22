import { api } from '../../api/api.js';

export async function fetchFundPeriods() {
  return api.rpc('get_fund_periods');
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

export async function fetchFundAdminLedger(limit = 50) {
  return api.select('fund_ledger', {
    columns: [
      'id',
      'member_key',
      'nickname',
      'year',
      'month',
      'week',
      'entry_type',
      'amount',
      'status',
      'memo',
      'ledger_date',
      'ledger_type',
      'category',
      'direction',
      'account',
      'approved_by_name',
      'created_at',
    ].join(','),
    orderBy: 'ledger_date',
    ascending: false,
    limit,
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

export async function createFundPayment(values) {
  return api.rpc('create_fund_payment', {
    p_member_key: values.member_key,
    p_year: values.year,
    p_month: values.month,
    p_week: values.week,
    p_amount: values.amount,
    p_account: values.account,
    p_ledger_date: values.ledger_date || null,
    p_memo: values.memo || null,
  });
}

export async function createFundTransaction(values) {
  return api.rpc('create_fund_transaction', {
    p_direction: values.direction,
    p_account: values.account,
    p_amount: values.amount,
    p_category: values.category,
    p_ledger_date: values.ledger_date || null,
    p_member_key: values.member_key || null,
    p_memo: values.memo || null,
  });
}

export async function cancelFundLedgerEntry(ledgerId, reason) {
  return api.rpc('cancel_fund_ledger_entry', {
    p_ledger_id: ledgerId,
    p_reason: reason || null,
  });
}
