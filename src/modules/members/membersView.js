export function renderMembersView(root, membersState) {
  const { items, loading, error } = membersState;

  root.innerHTML = `
    <section class="panel">
      <div class="panel__header">
        <div>
          <h2>멤버</h2>
          <p>첫 실제 기능 연결 예정</p>
        </div>
        <span class="badge">READY</span>
      </div>

      <div class="panel__body">
        ${
          loading
            ? '<p>불러오는 중...</p>'
            : error
              ? `<p class="error">${escapeHtml(error)}</p>`
              : items.length
                ? `<p>${items.length}명의 멤버가 로드되었습니다.</p>`
                : `
                  <div class="empty-state">
                    <strong>NEW AXE NET 기본 구조가 준비되었습니다.</strong>
                    <p>
                      다음 단계에서 Supabase 멤버 테이블을 연결하면 됩니다.
                    </p>
                  </div>
                `
        }
      </div>
    </section>
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
