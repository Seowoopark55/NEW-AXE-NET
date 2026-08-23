import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8');
const fail = [];
const notes = [];

const mainCss = read('src/styles/main.css');
const fundCss = read('src/modules/fund/fund.css');
const opsCss = read('src/modules/fund/operations-console.css');
const adminCss = read('src/modules/fund/views/admin.css');
const memberCss = read('src/modules/members/operations-members.css');
const noticeCss = read('src/modules/notice/notice.css');
const infoCss = read('src/modules/info/info.css');
const shellCss = read('src/styles/operations-shell.css');
const jsText = fs.readdirSync('src/modules/fund/views')
  .filter((name) => name.endsWith('.js'))
  .map((name) => read(path.join('src/modules/fund/views', name)))
  .join('\n');

if (/\.fund-[\w-]+/.test(mainCss)) {
  fail.push('main.css contains fund-specific selectors; fund styles must stay in the fund module.');
}

for (const legacyShell of ['.app-shell', '.sidebar', '.brand__', '.nav__item', '.main__wrap', '.utility-bar', '.hero-banner']) {
  if (mainCss.includes(legacyShell)) {
    fail.push(`main.css still contains obsolete pre-operations shell CSS: ${legacyShell}`);
  }
}

for (const deadMemberList of ['.member-stats', '.member-toolbar--split', '.member-search', '.member-table__row']) {
  if (mainCss.includes(deadMemberList)) {
    fail.push(`main.css still contains obsolete pre-operations members list CSS: ${deadMemberList}`);
  }
}

const cssForImportant = [mainCss, fundCss, opsCss, adminCss, memberCss, noticeCss, infoCss, shellCss];
if (cssForImportant.some((text) => text.includes('!important'))) {
  fail.push('canonical UI CSS still contains !important specificity patches.');
}

for (const legacy of ['fund-ledger-table', 'fund-ledger-shell', 'fund-admin--ledger-wide', 'fund-admin--medium', 'fund-admin--narrow']) {
  if (adminCss.includes(legacy) || jsText.includes(legacy)) {
    fail.push(`legacy layout token remains: ${legacy}`);
  }
}

if (fs.existsSync('src/modules/fund/views/settingsView.js')) {
  fail.push('unused legacy settingsView.js still exists.');
}

const desktopRows = [
  ['ops-ledger-row', /\.ops-ledger-row\s*\{[\s\S]*?grid-template-columns:\s*([^;]+);/],
  ['ops-review__top', /\.ops-review__top\s*\{[\s\S]*?grid-template-columns:\s*([^;]+);/],
  ['fund-admin-rule', /\.fund-admin-rule\s*\{[\s\S]*?grid-template-columns:\s*([^;]+);/],
  ['fund-admin-member__main', /\.fund-admin-member__main\s*\{[\s\S]*?grid-template-columns:\s*([^;]+);/],
];

for (const [name, re] of desktopRows) {
  const source = name.startsWith('ops-') ? opsCss : adminCss;
  const match = source.match(re);
  if (!match) {
    fail.push(`desktop data row geometry not found: ${name}`);
    continue;
  }
  const cols = match[1];
  if (/minmax\([^)]*,\s*1fr\)|(^|\s)1fr(\s|$)/.test(cols)) {
    fail.push(`${name} still has a desktop stretch column: ${cols}`);
  } else {
    notes.push(`${name}: ${cols.trim()}`);
  }
}

const cssFiles = [
  'src/styles/main.css',
  'src/styles/axe-ui-system.css',
  'src/styles/operations-shell.css',
  'src/modules/home/home.css',
  'src/modules/members/operations-members.css',
  'src/modules/notice/notice.css',
  'src/modules/info/info.css',
  'src/modules/fund/fund.css',
  'src/modules/fund/operations-console.css',
  'src/modules/fund/views/admin.css',
];
const owner = new Map();
for (const file of cssFiles) {
  const text = read(file);
  for (const match of text.matchAll(/([^{}]+)\{/g)) {
    const selectorText = match[1].trim();
    if (!selectorText || selectorText.startsWith('@')) continue;
    for (const selector of selectorText.split(',').map((s) => s.trim())) {
      if (!selector.startsWith('.')) continue;
      const key = selector.replace(/\s+/g, ' ');
      const files = owner.get(key) ?? new Set();
      files.add(file);
      owner.set(key, files);
    }
  }
}
const duplicated = [...owner.entries()].filter(([, files]) => files.size > 1);
if (duplicated.length) {
  fail.push(`fund selector ownership overlaps across files: ${duplicated.map(([s]) => s).join(', ')}`);
}

if (fail.length) {
  console.error('STYLE AUDIT: FAIL');
  for (const item of fail) console.error(`- ${item}`);
  process.exit(1);
}

console.log('STYLE AUDIT: PASS');
console.log('- fund styles are isolated from main.css');
console.log('- obsolete pre-operations shell CSS removed from main.css');
console.log('- legacy ledger/table CSS removed');
console.log('- no !important specificity patches in canonical UI CSS');
console.log('- no duplicate exact selector ownership across canonical UI styles');
console.log('- desktop low-density rows use explicit content-driven columns');
for (const note of notes) console.log(`  · ${note}`);
