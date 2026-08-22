import {
  escapeHtml,
  formatMoney,
  formatPeriodLabel,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderIntegrityView(state) {
  const { fund } = state;
  const requests = fund.admin.requests ?? [];
  const ledgers = fund.admin.ledgerItems ?? [];

  const activePayments = ledgers.filter((item) => item.status === 'active' && item.entry_type === 'payment');
  const activeByPeriod = new Map();
  for (const item of activePayments) {
    const key = `${item.member_key}:${item.year}:${item.month}:${item.week}`;
    const list = activeByPeriod.get(key) ?? [];
    list.push(item);
    activeByPeriod.set(key, list);
  }

  const duplicates = [...activeByPeriod.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, rows }));

  const approvedMissing = requests
    .filter((request) => request.status === 'approved')
    .filter((request) => {
      if (request.id && ledgers.some((ledger) => Number(ledger.request_id) === Number(request.id) && ledger.status === 'active')) {
        return false;
      }
      const key = `${request.member_key}:${request.year}:${request.month}:${request.week}`;
      return !(activeByPeriod.get(key)?.length);
    });

  const pendingWithPayment = requests
    .filter((request) => request.status === 'pending')
    .filter((request) => {
      const key = `${request.member_key}:${request.year}:${request.month}:${request.week}`;
      return Boolean(activeByPeriod.get(key)?.length);
    });

  const issueCount = duplicates.length + approvedMissing.length + pendingWithPayment.length;

  return `
    ${renderPageHeader(
      '정합성점검',
      '공금 신청과 납부내역 사이의 중복·누락을 자동 점검합니다.',
      '<button class="fund-secondary-button" type="button" data-fund-refresh>다시 점검</button>',
    )}

    <div class="fund-integrity-summary ${issueCount ? 'is-warning' : 'is-ok'}">
      <strong>${issueCount ? `${issueCount}건 확인 필요` : '정합성 이상 없음'}</strong>
      <span>${issueCount ? '아래 항목을 확인해 실제 운영 데이터와 맞는지 점검하세요.' : '현재 불러온 활성 요청과 공금내역에서 자동 판정 가능한 오류가 없습니다.'}</span>
    </div>

    ${renderSection('중복 활성 납부', duplicates.map((item) => `
      <article class="fund-integrity-item">
        <strong>${escapeHtml(item.rows[0]?.nickname || item.key)}</strong>
        <span>${formatPeriodLabel(item.rows[0])} · 활성 납부 ${item.rows.length}건</span>
      </article>
    `))}

    ${renderSection('승인 신청과 공금내역 불일치', approvedMissing.map((item) => `
      <article class="fund-integrity-item">
        <strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong>
        <span>${formatPeriodLabel(item)} · 승인 신청은 있으나 활성 납부내역을 찾지 못했습니다.</span>
      </article>
    `))}

    ${renderSection('검수대기인데 이미 납부완료', pendingWithPayment.map((item) => `
      <article class="fund-integrity-item">
        <strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong>
        <span>${formatPeriodLabel(item)} · 검수대기 요청과 활성 납부내역이 동시에 존재합니다.</span>
      </article>
    `))}
  `;
}

function renderSection(title, items) {
  return `
    <section class="fund-legacy-panel fund-integrity-section">
      <div class="fund-legacy-panel__head">
        <div><h3>${title}</h3><p>${items.length}건</p></div>
      </div>
      <div class="fund-integrity-list">
        ${items.length ? items.join('') : '<div class="fund-empty-state">해당 항목 없음</div>'}
      </div>
    </section>
  `;
}
