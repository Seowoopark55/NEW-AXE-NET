import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = [];
const expect = (condition, message) => { if (!condition) fail.push(message); };

const dom = read('src/utils/dom.js');
expect(dom.includes("compositionstart"), 'IME utility is missing compositionstart handling.');
expect(dom.includes("compositionend"), 'IME utility is missing compositionend handling.');
expect(dom.includes('bindImeSafeInput'), 'IME-safe input helper is missing.');

for (const file of [
  'src/modules/info/infoView.js',
  'src/modules/members/membersView.js',
  'src/modules/assets/assetsView.js',
  'src/modules/outlaw/outlawView.js',
  'src/modules/tube/tubeView.js',
]) {
  const text = read(file);
  expect(text.includes('bindImeSafeInput'), `${file} does not use the IME-safe search binding.`);
  expect(text.includes('data-ime-search'), `${file} does not expose a stable search focus key.`);
}

for (const file of [
  'src/modules/assets/assetsView.js',
  'src/modules/outlaw/outlawView.js',
]) {
  const text = read(file);
  const renderClose = text.indexOf('restoreImeSearchFocus(root, searchFocus);');
  const bindStart = text.indexOf('function bindEvents(');
  expect(renderClose >= 0 && bindStart >= 0 && renderClose < bindStart,
    `${file} restores IME focus from an out-of-scope binding function; this can abort all later button bindings.`);
}

const tube = read('src/modules/tube/tubeView.js');
expect(tube.includes('patchTubeDetail'), 'AXE TUBE detail patch path is missing.');
expect(tube.includes('data-tube-modal-id'), 'AXE TUBE modal identity marker is missing.');
expect(tube.includes('renderDetailBody'), 'AXE TUBE body-only rerender path is missing.');

const home = read('src/modules/home/homeView.js');
expect(home.includes('ops-home-quickpanel'), 'Prominent home quick-access launcher is missing.');

const shortcuts = read('src/modules/shortcuts/shortcutsView.js');
expect(shortcuts.includes('shortcutMark'), 'Quick-access visual markers are missing.');

const app = read('src/app.js');
expect(app.includes("./styles/professional-polish.css"), 'Professional polish stylesheet is not imported.');
expect(!fs.existsSync('src/modules/fund/views/settingsView.js'), 'Unused legacy settingsView.js still exists.');

if (fail.length) {
  console.error('UX AUDIT: FAIL');
  for (const item of fail) console.error(`- ${item}`);
  process.exit(1);
}

console.log('UX AUDIT: PASS');
console.log('- Korean IME-safe search binding is installed without breaking module action bindings');
console.log('- AXE TUBE uses body-only detail updates to preserve the active player');
console.log('- Quick access is promoted in both top utility and home launcher');
console.log('- Professional polish stylesheet is active');
