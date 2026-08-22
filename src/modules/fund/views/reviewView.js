import { escapeAttribute, escapeHtml, formatDateTime, formatMoney, formatPeriodLabel, requestStatusLabel } from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderReviewView(state) {
  const admin = state.fund.admin;
  const filter = admin.requestFilter;
  const requests = filter === 'all' ? admin.requests : admin.requests.filter((item) => item.status === filter);
  const pendingCount = admin.requests.filter((item) => item.status === 'pending').length;
  return `
    ${renderPageHeader('검수대기', '제출 증빙과 납부 구성을 확인하고 승인 또는 거절합니다.')}
    ${renderAdminMessage(admin)}
    <div class="fund-review-toolbar">
      ${renderFilter('pending', '검수대기', filter, pendingCount)}${renderFilter('approved', '승인완료', filter)}${renderFilter('rejected', '거절', filter)}${renderFilter('deleted', '삭제됨', filter)}${renderFilter('all', '전체', filter)}
    </div>
    <div class="fund-review-list fund-review-list--parity">${requests.length ? requests.map(renderRequest).join('') : '<div class="fund-empty-state fund-empty-state--large">해당 상태의 제출이 없습니다.</div>'}</div>`;
}

function renderFilter(value, label, selected, count = null) {
  return `<button class="fund-filter-chip ${selected === value ? 'fund-filter-chip--active' : ''}" type="button" data-request-filter="${value}">${label}${count !== null ? ` <b>${count}</b>` : ''}</button>`;
}

function renderRequest(item) {
  const pending = item.status === 'pending';
  return `
    <article class="fund-review-item fund-review-item--parity ${pending ? 'fund-review-item--pending' : ''}">
      <div class="fund-review-item__content">
        ${item.evidence_url ? `<button class="fund-review-evidence" type="button" data-evidence-preview="${escapeAttribute(item.evidence_url)}" data-evidence-label="${escapeAttribute(`${item.nickname || '멤버'} · ${formatPeriodLabel(item)} 증빙`)}"><img src="${escapeAttribute(item.evidence_url)}" alt="${escapeAttribute(item.nickname || '')} 증빙" /><span>증빙 크게 보기</span></button>` : '<div class="fund-review-evidence fund-review-evidence--missing">증빙 없음</div>'}
        <div class="fund-review-item__body">
          <div class="fund-review-item__head">
            <div><div class="fund-review-item__title"><strong>${escapeHtml(item.nickname || '멤버')}</strong><span class="fund-request-pill fund-request-pill--${item.status}">${requestStatusLabel(item.status)}</span></div><span>${formatPeriodLabel(item)} · ${paymentDetail(item)}</span></div>
            <b>${formatMoney(item.amount)}</b>
          </div>
          <div class="fund-review-item__meta"><span>${formatDateTime(item.created_at)} 제출</span>${item.proxy_admin_name ? `<span>대리제출 · ${escapeHtml(item.proxy_admin_name)}</span>` : ''}${item.discord_name ? `<span>Discord · ${escapeHtml(item.discord_name)}</span>` : ''}${item.reviewer_discord_name ? `<span>${escapeHtml(item.reviewer_discord_name)} 검수</span>` : ''}</div>
          ${item.memo ? `<p>메모 · ${escapeHtml(item.memo)}</p>` : ''}
          ${item.review_note ? `<p class="fund-review-item__review">검수 메모 · ${escapeHtml(item.review_note)}</p>` : ''}
          ${pending ? `<div class="fund-review-item__actions"><button class="fund-danger-button" type="button" data-reject-request="${item.id}">거절</button><button class="fund-primary-button" type="button" data-approve-request="${item.id}">승인 · 납부완료</button></div>` : ''}
        </div>
      </div>
    </article>`;
}

function paymentDetail(item) {
  if (item.payment_mode === '분할납부') return `분할 · 공용 ${formatMoney(item.public_amount)} + 잔고 ${formatMoney(item.company_amount)}`;
  return item.payment_mode || '공용계좌';
}

function renderAdminMessage(admin) {
  return `${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}`;
}
