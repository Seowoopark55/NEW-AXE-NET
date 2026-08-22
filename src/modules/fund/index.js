import { store } from '../../state/store.js';
import {
  fetchFundPeriods,
  fetchFundPeriodStatus,
  fetchFundRecentLedger,
  fetchFundSummary,
} from './fundService.js';
import { renderFundView } from './fundView.js';

export async function initFundModule() {
  const root = document.querySelector('#module-root');

  if (!root) {
    throw new Error('#module-root element not found.');
  }

  const rerender = () => {
    if (store.getState().ui.activeModule !== 'fund') {
      return;
    }

    renderFundView(root, store.getState(), {
      async onPeriodChange(period) {
        await loadFundPeriod(period);
      },
    });
  };

  store.subscribe(rerender);

  try {
    const [periods, summary, recentLedger] = await Promise.all([
      fetchFundPeriods(),
      fetchFundSummary(),
      fetchFundRecentLedger(12),
    ]);

    const selectedPeriod = summary?.period ?? periods?.[0] ?? null;
    const statusItems = selectedPeriod
      ? await fetchFundPeriodStatus(selectedPeriod)
      : [];

    store.updateState((state) => ({
      ...state,
      fund: {
        initialized: true,
        loading: false,
        error: null,
        periods: periods ?? [],
        selectedPeriod,
        summary,
        statusItems,
        recentLedger: recentLedger ?? [],
      },
    }));
  } catch (error) {
    console.error('[NEW AXE NET] fund load failed:', error);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        initialized: true,
        loading: false,
        error: error?.message ?? String(error),
      },
    }));
  }

  rerender();
}

async function loadFundPeriod(period) {
  store.updateState((state) => ({
    ...state,
    fund: {
      ...state.fund,
      loading: true,
      error: null,
      selectedPeriod: period,
    },
  }));

  try {
    const [summary, statusItems] = await Promise.all([
      fetchFundSummary(period),
      fetchFundPeriodStatus(period),
    ]);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        loading: false,
        error: null,
        selectedPeriod: period,
        summary,
        statusItems: statusItems ?? [],
      },
    }));
  } catch (error) {
    console.error('[NEW AXE NET] fund period load failed:', error);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        loading: false,
        error: error?.message ?? String(error),
      },
    }));
  }
}
