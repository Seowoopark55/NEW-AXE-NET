export function renderMembersView(root, state) {
  const { members, system } = state;

  root.innerHTML = `
    <section class="panel">
      <div class="panel__header">
        <div>
          <h2>멤버</h2>
          <p>첫 실제 기능 연결 준비</p>
        </div>
        <span class="badge">${system.connected ? 'DB READY' : 'READY'}</span>
      </div>

      <div class="panel__body">
        ${renderSystemMessage(system)}
        ${renderMembersBody(members)}
      </div>
    </section>
  `;
}

function renderSystemMessage(system) {
  if (system.checking) {
    return `
      <div class="notice">
        Supabase 연결을 확인하고 있습니다.
      </div>
    `;
  }

  if (system.error) {
    return `
      <div class="notice notice--error">
        <strong>Supabase 연결 실패</strong>
        <span>${escapeHtml(system.error)}</span>
      </div>
    `;
  }

  if (system.connected) {
    return `
      <div class="notice notice--success">
        <strong>Supabase 연결 성공</strong>
        <span>new_axe_net schema와 정상 통신 중입니다.</span>
      </div>
    `;
  }

  return '';
}

function renderMembersBody(members) {
  const { items, loading, error } = members;

  if (loading) {
    return '<p>멤버를 불러오는 중...</p>';
  }

  if (error) {
    return `<p class="error">${escapeHtml(error)}</p>`;
  }

  if (items.length) {
    return `<p>${items.length}명의 멤버가 로드되었습니다.</p>`;
  }

  return `
    <div class="empty-state">
      <strong>기본 시스템 연결 단계입니다.</strong>
      <p>
        연결 테스트가 성공하면 다음 단계에서 실제 멤버 테이블을 설계합니다.
      </p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
