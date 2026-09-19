const SYSTEM_META = {
  axe_net: {
    title: 'AXE NET',
    description: '웹 서비스와 일반 사용자 기능을 제어합니다.',
  },
  axe_bot: {
    title: 'AXE BOT',
    description: 'Discord BOT 명령, 버튼 및 자동 기능을 제어합니다.',
  },
};

export function renderSystemControlView(root, state, actions = {}) {
  const runtime = state.runtimeControl || {};
  const isSuperadmin = state.auth?.admin?.admin_level === 'superadmin';

  if (!isSuperadmin) {
    root.innerHTML = `
      <section class="ops-system-control">
        <div class="ops-system-control__denied">
          <strong>접근 권한이 없습니다.</strong>
          <p>시스템 제어는 최고관리자만 사용할 수 있습니다.</p>
        </div>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    <section class="ops-system-control" aria-label="AXE 시스템 제어">
      <header class="ops-system-control__head">
        <div>
          <span>SYSTEM CONTROL</span>
          <h1>시스템 제어</h1>
          <p>서비스를 중지해도 데이터와 설정은 삭제되지 않습니다.</p>
        </div>
        <button type="button" class="ops-system-control__refresh" data-runtime-refresh ${runtime.loading ? 'disabled' : ''}>
          ${runtime.loading ? '확인 중' : '상태 새로고침'}
        </button>
      </header>

      ${runtime.error ? `<div class="ops-system-control__error">${escapeHtml(runtime.error)}</div>` : ''}

      <div class="ops-system-control__grid">
        ${['axe_net', 'axe_bot'].map((key) => renderCard(key, runtime)).join('')}
      </div>

      <div class="ops-system-control__notice">
        <strong>안전 동작</strong>
        <span>OFF는 서버 종료나 데이터 삭제가 아니라 서비스 기능을 차단하는 운영 상태입니다. 최고관리자는 AXE NET에 로그인해 언제든 다시 ON으로 전환할 수 있습니다.</span>
      </div>
    </section>
  `;

  root.querySelector('[data-runtime-refresh]')?.addEventListener('click', () => actions.onRefresh?.());
  root.querySelectorAll('[data-runtime-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.runtimeToggle;
      const current = runtime.items?.[key]?.enabled !== false;
      actions.onToggle?.(key, !current);
    });
  });
}

function renderCard(key, runtime) {
  const meta = SYSTEM_META[key];
  const item = runtime.items?.[key] || null;
  const enabled = item?.enabled !== false;
  const saving = runtime.savingKey === key;
  const stateLabel = item ? (enabled ? '운영 중' : '운영 중지') : '확인 필요';
  const updatedAt = item?.updated_at ? formatDate(item.updated_at) : '—';

  return `
    <article class="ops-system-control-card ${enabled ? 'is-on' : 'is-off'}">
      <div class="ops-system-control-card__copy">
        <div class="ops-system-control-card__status">
          <i></i>
          <span>${stateLabel}</span>
        </div>
        <h2>${meta.title}</h2>
        <p>${meta.description}</p>
        <small>최근 변경 ${escapeHtml(updatedAt)}</small>
      </div>
      <button
        type="button"
        class="ops-system-toggle ${enabled ? 'is-on' : 'is-off'}"
        data-runtime-toggle="${key}"
        aria-pressed="${enabled ? 'true' : 'false'}"
        ${saving || !item ? 'disabled' : ''}
      >
        <span>${saving ? '변경 중' : enabled ? 'ON' : 'OFF'}</span>
        <i aria-hidden="true"></i>
      </button>
    </article>
  `;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
