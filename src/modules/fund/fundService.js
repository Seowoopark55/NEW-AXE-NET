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
