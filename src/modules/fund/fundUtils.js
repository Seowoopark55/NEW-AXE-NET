export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

export function formatMoney(value) {
  const number = Number(value ?? 0);
  const normalized = Number.isFinite(number) ? number : 0;
  return `${normalized.toLocaleString('ko-KR')}원`;
}

export function formatPeriodLabel(period) {
  if (!period) return '기간 없음';
  return `${period.year}년 ${period.month}월 ${period.week}주차`;
}

export function formatMonthLabel(month) {
  if (!month) return '월 없음';
  return `${month.year}년 ${month.month}월`;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getLocalDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function toInputDate(value) {
  if (!value) return getLocalDateString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function renderStatusBadge(status) {
  const classes = {
    '완료': 'done',
    '미납': 'unpaid',
    '면제': 'exempt',
    '예정': 'scheduled',
    '가입 전': 'before',
  };
  const type = classes[status] ?? 'before';
  return `<span class="fund-status-badge fund-status-badge--${type}">${escapeHtml(status)}</span>`;
}

export function requestStatusLabel(status) {
  const labels = {
    pending: '검수대기',
    approved: '승인',
    rejected: '거절',
    deleted: '삭제됨',
  };
  return labels[status] ?? status ?? '—';
}

export function ledgerSign(item) {
  if (item.direction === '지출') return '-';
  if (item.direction === '조정') return Number(item.amount ?? 0) >= 0 ? '+' : '-';
  return '+';
}

export function ledgerAmountType(item) {
  if (item.direction === '지출') return 'out';
  if (item.direction === '조정' && Number(item.amount ?? 0) < 0) return 'out';
  return 'in';
}
