import { store } from '../../state/store.js';
import { renderMembersView } from './membersView.js';

export async function initMembersModule() {
  const root = document.querySelector('#module-root');

  if (!root) {
    throw new Error('#module-root element not found.');
  }

  renderMembersView(root, store.getState());

  store.subscribe((state) => {
    renderMembersView(root, state);
  });
}
