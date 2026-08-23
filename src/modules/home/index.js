import { store } from '../../state/store.js';
import { renderHomeView } from './homeView.js';

export function initHomeModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  const rerender = () => {
    if (store.getState().ui.activeModule !== 'home') return;

    renderHomeView(root, store.getState(), {
      onOpenModule(moduleName) {
        store.updateState((state) => ({
          ...state,
          ui: {
            ...state.ui,
            activeModule: moduleName,
          },
        }));
      },

      onOpenFundSection(section) {
        const current = store.getState();
        const adminOnly = new Set(['review', 'history', 'balance', 'feeRules', 'exemptions', 'integrity', 'fundMembers']);
        const nextSection = adminOnly.has(section) && !current.auth.admin ? 'overview' : section;

        store.updateState((state) => ({
          ...state,
          ui: {
            ...state.ui,
            activeModule: 'fund',
          },
          fund: {
            ...state.fund,
            section: nextSection,
          },
        }));
      },
    });
  };

  rerender();
  store.subscribe(rerender);
}
