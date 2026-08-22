import { store } from '../../state/store.js';
import { fetchMembers } from './membersService.js';
import { renderMembersView } from './membersView.js';

export async function initMembersModule() {
  const root = document.querySelector('#module-root');

  if (!root) {
    throw new Error('#module-root element not found.');
  }

  const rerender = () => {
    renderMembersView(root, store.getState(), {
      onFilterChange(filter) {
        store.updateState((state) => ({
          ...state,
          members: {
            ...state.members,
            filter,
          },
        }));
      },
    });
  };

  rerender();
  store.subscribe(rerender);

  store.updateState((state) => ({
    ...state,
    members: {
      ...state.members,
      loading: true,
      error: null,
    },
  }));

  try {
    const items = await fetchMembers();

    store.updateState((state) => ({
      ...state,
      members: {
        ...state.members,
        items,
        loading: false,
        error: null,
      },
    }));
  } catch (error) {
    console.error('[NEW AXE NET] members load failed:', error);

    store.updateState((state) => ({
      ...state,
      members: {
        ...state.members,
        loading: false,
        error: error?.message ?? String(error),
      },
    }));
  }
}
