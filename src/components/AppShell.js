export function renderAppShell(root) {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand__title">NEW AXE NET</div>
          <div class="brand__subtitle">Modular System</div>
        </div>

        <nav class="nav">
          <button class="nav__item nav__item--active" type="button">
            멤버
          </button>
        </nav>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <h1>NEW AXE NET</h1>
            <p>Supabase-first modular architecture</p>
          </div>
        </header>

        <section id="module-root" class="module-root"></section>
      </main>
    </div>
  `;
}
