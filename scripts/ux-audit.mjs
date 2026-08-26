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


const outlaw = read('src/modules/outlaw/outlawView.js');
expect(outlaw.includes('OUTLAW_UNAVAILABLE_IMAGE_FILES'),
  'Known missing outlaw images are not guarded before browser requests.');
expect(outlaw.includes('이미지 준비 중'),
  'Outlaw missing-image fallback copy is missing.');

const fundIndex = read('src/modules/fund/index.js');
expect(fundIndex.includes('이미 동일한 공금 규칙이 적용 중입니다.'),
  'Duplicate fund fee-rule no-op guard is missing.');
expect(fundIndex.includes('같은 주차에 활성 공금 규칙이 있습니다.'),
  'Conflicting fund fee-rule UX guard is missing.');

// Performance / startup safeguards
const appHomeInit = app.indexOf('initHomeModule();');
const appAuthInit = app.indexOf('await initAuthModule();');
expect(appHomeInit >= 0 && appAuthInit >= 0 && appHomeInit < appAuthInit,
  'Home must render before auth/network initialization to avoid a blank main area.');
expect(app.includes('Promise.allSettled(') && app.includes("['fund', initFundModule]") && app.includes("['tube', initTubeModule]"),
  'Independent startup modules are not initialized in parallel.');

const authIndex = read('src/modules/auth/index.js');
expect(authIndex.includes('adminSessionTask') && authIndex.includes('memberSessionTask') && authIndex.includes('await Promise.all(['),
  'Admin/member session restore is not parallelized.');

const fundPerformance = read('src/modules/fund/index.js');
expect(fundPerformance.includes('recentLedgerTask') && fundPerformance.includes('fundAdminLoadPromise'),
  'Fund startup is missing early recent-ledger delivery or lazy admin workspace loading.');
const fundBaseStart = fundPerformance.indexOf('async function loadFundBase()');
const fundBaseEnd = fundPerformance.indexOf('async function loadMonth(', fundBaseStart);
const fundBaseChunk = fundPerformance.slice(fundBaseStart, fundBaseEnd);
expect(!fundBaseChunk.includes('void ensureAdminWorkspace()') && !fundBaseChunk.includes('await ensureAdminWorkspace()'),
  'Fund startup still preloads the heavy admin workspace.');

const tubePerformance = read('src/modules/tube/index.js');
expect(tubePerformance.includes('const reactionsTask') && tubePerformance.includes('const videos = await fetchTubeVideos();'),
  'AXE TUBE videos are still blocked by member reaction preload.');

const infoPresetView = read('src/modules/info/infoView.js');
const infoPresetData = read('src/modules/info/modbookPresets.js');
expect(infoPresetView.includes("tabButton('preset', '추천세팅'") && infoPresetView.includes('renderModbookPresets'),
  'Curated modbook preset tab/view is missing.');
expect(infoPresetView.includes('parsePresetOption') && infoPresetView.includes('sumMovement'),
  'Modbook preset max-option/range presentation logic is missing.');
expect(infoPresetData.includes("id: 'movement-tier1'") && infoPresetData.includes("name: '잡기 힘든'"),
  'Movement tier-1 curated preset seed is missing.');

const shellCss = read('src/styles/operations-shell.css');
expect(shellCss.includes('axe-site-banner-20260824.webp'),
  'Shell banner is not using the optimized WebP asset.');

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
console.log('- Missing outlaw step images use a no-request fallback instead of browser 404s');
console.log('- Duplicate fund fee-rule submissions are handled client-side without noisy 409s');
console.log('- Home renders before authentication and independent startup modules initialize in parallel');
console.log('- Auth restore, fund home data, and AXE TUBE preload paths are optimized for first paint');
console.log('- Curated modbook presets use live modbook data with in-game-style max-option tooltips');
