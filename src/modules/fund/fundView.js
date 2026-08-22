export function renderFundView(root, state, actions = {}) {
  const { fund, system, auth, members } = state;

  if (!system.connected) {
    root.innerHTML = `
      <section class="panel">
        <div class="panel__header">
          <div>
            <h2>공금</h2>
            <p>데이터 연결 대기</p>
          </div>
        </div>
        <div class="panel__body">
          <div class="notice ${system.error ? 'notice--error' : ''}">
            ${system.error ? escapeHtml(system.error) : 'Supabase 연결을 확인하고 있습니다.'}
          </div>
        </div>
      </section>
    `;
    return;
  }

  if (!fund.initialized) {
    root.innerHTML = `
      <section class="panel">
        <div class="panel__body">
          <div class="notice">공금 데이터를 준비하고 있습니다.</div>
        </div>
      </section>
    `;
    return;
  }

  if (fund.error) {
    root.innerHTML = `
      <section class="panel">
        <div class="panel__header">
          <div>
            <h2>공금</h2>
            <p>Supabase · new_axe_net.fund_*</p>
          </div>
        </div>
        <div class="panel__body">
          <div class="notice notice--error">
            <strong>공금 데이터 로드 실패</strong>
            <span>${escapeHtml(fund.error)}</span>
          </div>
        </div>
      </section>
    `;
    return;
  }

  const summary = fund.summary ?? {};
  const period = summary.period ?? fund.selectedPeriod;
  const balance = summary.balance ?? {};
  const counts = summary.counts ?? {};
  const amounts = summary.amounts ?? {};

  root.innerHTML = `
    <section class="panel fund-panel">
      <div class="panel__header fund-header">
        <div>
          <h2>공금</h2>
          <p>원장 · 주간 현황 · 면제/회비 규칙 · 실시간 계산</p>
        </div>

        <div class="fund-header-actions">
          ${
            auth.admin
              ? `
                <button class="fund-admin-button" type="button" data-open-fund-admin>
                  공금 관리
                </button>
              `
              : ''
          }

          <label class="fund-period-select">
            <span>조회 기간</span>
            <select data-fund-period ${fund.loading ? 'disabled' : ''}>
              ${renderPeriodOptions(fund.periods, period)}
            </select>
          </label>
        </div>
      </div>

      <div class="panel__body">
        ${fund.loading ? '<div class="notice">선택한 기간을 불러오는 중입니다.</div>' : ''}

        <div class="fund-balance-grid">
          ${renderKpi('전체 잔액', formatMoney(balance.total), '현재 active 원장 기준')}
          ${renderKpi('공용계좌', formatMoney(balance.public), '수입 - 지출 + 조정')}
          ${renderKpi('회사잔고', formatMoney(balance.company), '회사잔고 배정분')}
          ${renderKpi('주간 공금', formatMoney(summary.fee), formatPeriodLabel(period))}
        </div>

        <div class="fund-period-summary">
          <div class="fund-period-summary__head">
            <div>
              <span>WEEKLY STATUS</span>
              <h3>${formatPeriodLabel(period)}</h3>
            </div>
            <div class="fund-period-summary__amount">
              <span>납부 대상</span>
              <strong>${formatMoney(amounts.expected)}</strong>
            </div>
          </div>

          <div class="fund-status-cards">
            ${renderStatusCard('완료', counts.completed, amounts.paid, 'done')}
            ${renderStatusCard('미납', counts.unpaid, amounts.unpaid, 'unpaid')}
            ${renderStatusCard('면제', counts.exempt, amounts.exempt, 'exempt')}
            ${renderStatusCard('예정', counts.scheduled, 0, 'scheduled')}
          </div>
        </div>

        <div class="fund-content-grid">
          <section class="fund-section">
            <div class="fund-section__header">
              <div>
                <h3>주간 멤버 현황</h3>
                <p>${Number(counts.members ?? 0).toLocaleString('ko-KR')}명 기준</p>
              </div>
            </div>

            <div class="fund-status-table-wrap">
              <table class="fund-status-table">
                <thead>
                  <tr>
                    <th>순번</th>
                    <th>닉네임</th>
                    <th>상태</th>
                    <th class="fund-number">금액</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    fund.statusItems.length
                      ? fund.statusItems.map((item, index) => renderStatusRow(item, index + 1)).join('')
                      : '<tr><td colspan="4" class="fund-empty">표시할 데이터가 없습니다.</td></tr>'
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section class="fund-section">
            <div class="fund-section__header">
              <div>
                <h3>최근 공금 내역</h3>
                <p>active 원장 최근 12건</p>
              </div>
            </div>

            <div class="fund-ledger-list">
              ${
                fund.recentLedger.length
                  ? fund.recentLedger.map(renderLedgerItem).join('')
                  : '<div class="fund-empty fund-empty--block">최근 내역이 없습니다.</div>'
              }
            </div>
          </section>
        </div>

        <div class="fund-live-note">
          <strong>LIVE ENGINE</strong>
          주간 상태는 현재 members + fund_fee_rules + fund_exemptions + fund_ledger를 기준으로 실시간 계산됩니다.
          fund_status_snapshot은 이전 검증 자료로만 보존됩니다.
        </div>
      </div>
    </section>

    ${
      fund.admin.open && auth.admin
        ? renderFundAdminModal(fund, members.items)
        : ''
    }
  `;

  root.querySelector('[data-fund-period]')?.addEventListener('change', (event) => {
    const [year, month, week] = event.target.value.split('-').map(Number);
    actions.onPeriodChange?.({ year, month, week });
  });

  root.querySelector('[data-open-fund-admin]')?.addEventListener('click', () => {
    actions.onOpenAdmin?.();
  });

  root.querySelectorAll('[data-close-fund-admin]').forEach((element) => {
    element.addEventListener('click', () => {
      actions.onCloseAdmin?.();
    });
  });

  root.querySelectorAll('[data-fund-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      actions.onAdminTabChange?.(button.dataset.fundAdminTab);
    });
  });

  const exemptionForm = root.querySelector('[data-fund-exemption-form]');
  exemptionForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(exemptionForm);
    const selectedPeriod = fund.selectedPeriod;

    if (!selectedPeriod) return;

    actions.onCreateExemption?.({
      member_key: String(formData.get('member_key') ?? ''),
      year: selectedPeriod.year,
      month: selectedPeriod.month,
      week: selectedPeriod.week,
      reason: String(formData.get('reason') ?? '').trim(),
    });
  });

  root.querySelectorAll('[data-disable-exemption]').forEach((button) => {
    button.addEventListener('click', () => {
      actions.onDisableExemption?.(Number(button.dataset.disableExemption));
    });
  });

  const feeRuleForm = root.querySelector('[data-fund-fee-rule-form]');
  feeRuleForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(feeRuleForm);

    actions.onCreateFeeRule?.({
      start_year: Number(formData.get('start_year')),
      start_month: Number(formData.get('start_month')),
      start_week: Number(formData.get('start_week')),
      weekly_fee: Number(formData.get('weekly_fee')),
      note: String(formData.get('note') ?? '').trim(),
    });
  });

  root.querySelectorAll('[data-toggle-fee-rule]').forEach((button) => {
    button.addEventListener('click', () => {
      actions.onToggleFeeRule?.(
        Number(button.dataset.toggleFeeRule),
        button.dataset.nextEnabled === 'true',
      );
    });
  });
}

function renderFundAdminModal(fund, memberItems) {
  const admin = fund.admin;
  const period = fund.selectedPeriod;
  const activeMembers = memberItems.filter((member) => member.status === 'active');

  return `
    <div class="fund-admin-backdrop" data-close-fund-admin></div>

    <section class="fund-admin-modal" role="dialog" aria-modal="true" aria-label="공금 관리">
      <div class="fund-admin-modal__header">
        <div>
          <span>FUND ADMIN</span>
          <h3>공금 관리</h3>
          <p>면제와 주간 공금 규칙을 Supabase에 즉시 반영합니다.</p>
        </div>

        <button
          class="fund-admin-modal__close"
          type="button"
          aria-label="닫기"
          data-close-fund-admin
        >
          ×
        </button>
      </div>

      <div class="fund-admin-tabs">
        ${renderAdminTab('exemptions', '면제 관리', admin.tab)}
        ${renderAdminTab('feeRules', '회비 규칙', admin.tab)}
      </div>

      <div class="fund-admin-modal__body">
        ${
          admin.loading
            ? '<div class="notice">관리 데이터를 불러오는 중입니다.</div>'
            : ''
        }

        ${
          admin.message
            ? `<div class="fund-admin-message fund-admin-message--success">${escapeHtml(admin.message)}</div>`
            : ''
        }

        ${
          admin.error
            ? `<div class="fund-admin-message fund-admin-message--error">${escapeHtml(admin.error)}</div>`
            : ''
        }

        ${
          admin.tab === 'feeRules'
            ? renderFeeRulesAdmin(admin, period)
            : renderExemptionsAdmin(admin, period, activeMembers)
        }
      </div>
    </section>
  `;
}

function renderAdminTab(value, label, activeTab) {
  return `
    <button
      class="fund-admin-tab ${value === activeTab ? 'fund-admin-tab--active' : ''}"
      type="button"
      data-fund-admin-tab="${value}"
    >
      ${label}
    </button>
  `;
}

function renderExemptionsAdmin(admin, period, activeMembers) {
  return `
    <div class="fund-admin-section-head">
      <div>
        <h4>주간 면제</h4>
        <p>${formatPeriodLabel(period)} · 활성 면제만 표시</p>
      </div>
      <span>${admin.exemptions.length}건</span>
    </div>

    <form class="fund-admin-form" data-fund-exemption-form>
      <div class="fund-admin-form-grid">
        <label class="member-edit-field">
          <span>멤버</span>
          <select name="member_key" required>
            <option value="">선택</option>
            ${activeMembers.map((member) => `
              <option value="${escapeAttribute(member.member_key)}">
                ${escapeHtml(member.nickname)}
              </option>
            `).join('')}
          </select>
        </label>

        <label class="member-edit-field fund-admin-form-grid__wide">
          <span>면제 사유</span>
          <input
            type="text"
            name="reason"
            maxlength="200"
            placeholder="예: 신규 가입 주차 / 운영진 승인"
          />
        </label>
      </div>

      <button
        class="fund-admin-primary"
        type="submit"
        ${admin.saving ? 'disabled' : ''}
      >
        ${admin.saving ? '처리 중...' : '면제 등록'}
      </button>
    </form>

    <div class="fund-admin-list">
      ${
        admin.exemptions.length
          ? admin.exemptions.map(renderExemptionItem).join('')
          : '<div class="fund-admin-empty">이 주차에 활성 면제가 없습니다.</div>'
      }
    </div>
  `;
}

function renderExemptionItem(item) {
  return `
    <article class="fund-admin-list-item">
      <div>
        <strong>${escapeHtml(item.nickname || '멤버')}</strong>
        <span>${escapeHtml(item.reason || '사유 없음')}</span>
        <small>
          ${escapeHtml(item.created_by || '관리자')}
          · ${formatDateTime(item.created_at)}
        </small>
      </div>

      <button
        class="fund-admin-danger"
        type="button"
        data-disable-exemption="${item.id}"
      >
        면제 해제
      </button>
    </article>
  `;
}

function renderFeeRulesAdmin(admin, selectedPeriod) {
  const defaultYear = selectedPeriod?.year ?? new Date().getFullYear();
  const defaultMonth = selectedPeriod?.month ?? new Date().getMonth() + 1;
  const defaultWeek = selectedPeriod?.week ?? 1;

  return `
    <div class="fund-admin-section-head">
      <div>
        <h4>주간 공금 규칙</h4>
        <p>새 적용 시점을 추가하는 방식으로 이력을 보존합니다.</p>
      </div>
      <span>${admin.feeRules.filter((rule) => rule.enabled).length}개 활성</span>
    </div>

    <form class="fund-admin-form" data-fund-fee-rule-form>
      <div class="fund-admin-form-grid fund-admin-form-grid--rule">
        <label class="member-edit-field">
          <span>시작 연도</span>
          <input type="number" name="start_year" min="2020" max="2100" value="${defaultYear}" required />
        </label>

        <label class="member-edit-field">
          <span>월</span>
          <input type="number" name="start_month" min="1" max="12" value="${defaultMonth}" required />
        </label>

        <label class="member-edit-field">
          <span>주차</span>
          <input type="number" name="start_week" min="1" max="5" value="${defaultWeek}" required />
        </label>

        <label class="member-edit-field">
          <span>주간 공금</span>
          <input type="number" name="weekly_fee" min="0" step="1000" value="20000" required />
        </label>

        <label class="member-edit-field fund-admin-form-grid__wide">
          <span>메모</span>
          <input
            type="text"
            name="note"
            maxlength="200"
            placeholder="예: 9월 1주차부터 30,000원"
          />
        </label>
      </div>

      <div class="fund-admin-warning">
        과거 시점에 새 규칙을 추가하면 해당 시점 이후의 과거 주차 계산도 달라질 수 있습니다.
      </div>

      <button
        class="fund-admin-primary"
        type="submit"
        ${admin.saving ? 'disabled' : ''}
      >
        ${admin.saving ? '처리 중...' : '새 회비 규칙 추가'}
      </button>
    </form>

    <div class="fund-admin-list fund-admin-list--rules">
      ${
        admin.feeRules.length
          ? admin.feeRules.map(renderFeeRuleItem).join('')
          : '<div class="fund-admin-empty">등록된 회비 규칙이 없습니다.</div>'
      }
    </div>
  `;
}

function renderFeeRuleItem(rule) {
  const isBase = rule.source_key === 'base_weekly_fee';

  return `
    <article class="fund-admin-list-item fund-admin-list-item--rule">
      <div>
        <strong>
          ${rule.start_year}년 ${rule.start_month}월 ${rule.start_week}주차
          · ${formatMoney(rule.weekly_fee)}
        </strong>
        <span>${escapeHtml(rule.note || '메모 없음')}</span>
        <small>
          ${rule.enabled ? '활성' : '비활성'}
          ${isBase ? ' · 기본 fallback' : ''}
        </small>
      </div>

      ${
        isBase
          ? '<span class="fund-admin-locked">고정</span>'
          : `
            <button
              class="${rule.enabled ? 'fund-admin-danger' : 'fund-admin-secondary'}"
              type="button"
              data-toggle-fee-rule="${rule.id}"
              data-next-enabled="${rule.enabled ? 'false' : 'true'}"
            >
              ${rule.enabled ? '비활성화' : '활성화'}
            </button>
          `
      }
    </article>
  `;
}

function renderPeriodOptions(periods, selected) {
  return periods.map((period) => {
    const value = `${period.year}-${period.month}-${period.week}`;
    const selectedValue = selected
      ? `${selected.year}-${selected.month}-${selected.week}`
      : '';

    return `
      <option value="${value}" ${value === selectedValue ? 'selected' : ''}>
        ${period.year}년 ${period.month}월 ${period.week}주차
      </option>
    `;
  }).join('');
}

function renderKpi(label, value, note) {
  return `
    <div class="fund-kpi">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </div>
  `;
}

function renderStatusCard(label, count, amount, type) {
  return `
    <div class="fund-status-card fund-status-card--${type}">
      <div>
        <span>${label}</span>
        <strong>${Number(count ?? 0).toLocaleString('ko-KR')}</strong>
      </div>
      <small>${amount ? formatMoney(amount) : '—'}</small>
    </div>
  `;
}

function renderStatusRow(item, displayOrder) {
  return `
    <tr>
      <td>${displayOrder}</td>
      <td><strong>${escapeHtml(item.nickname ?? '')}</strong></td>
      <td>${renderStatusBadge(item.status)}</td>
      <td class="fund-number">${formatMoney(item.amount)}</td>
    </tr>
  `;
}

function renderStatusBadge(status) {
  const classNames = {
    '완료': 'done',
    '미납': 'unpaid',
    '면제': 'exempt',
    '예정': 'scheduled',
    '가입 전': 'before',
  };

  const className = classNames[status] ?? 'before';

  return `<span class="fund-status-badge fund-status-badge--${className}">${escapeHtml(status)}</span>`;
}

function renderLedgerItem(item) {
  const amount = Number(item.amount ?? 0);
  const sign =
    item.direction === '지출'
      ? '-'
      : item.direction === '조정'
        ? (amount >= 0 ? '+' : '')
        : '+';

  return `
    <article class="fund-ledger-item">
      <div class="fund-ledger-item__main">
        <div>
          <strong>${escapeHtml(item.category || item.ledger_type || '공금')}</strong>
          <span>${escapeHtml(item.nickname || item.account || '공용')}</span>
        </div>
        <b class="fund-ledger-amount fund-ledger-amount--${ledgerAmountType(item)}">
          ${sign}${formatMoney(Math.abs(amount))}
        </b>
      </div>
      <div class="fund-ledger-item__meta">
        <span>${formatDate(item.ledger_date)}</span>
        <span>${escapeHtml(item.account || '')}</span>
      </div>
    </article>
  `;
}

function ledgerAmountType(item) {
  if (item.direction === '지출') return 'out';
  if (item.direction === '조정' && Number(item.amount ?? 0) < 0) return 'out';
  return 'in';
}

function formatMoney(value) {
  const number = Number(value ?? 0);
  return `${Number.isFinite(number) ? number.toLocaleString('ko-KR') : '0'}원`;
}

function formatPeriodLabel(period) {
  if (!period) return '기간 없음';
  return `${period.year}년 ${period.month}월 ${period.week}주차`;
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
