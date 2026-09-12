#!/usr/bin/env node
/** Post-build sanity check: internal links, assets, ids, and basic a11y. */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'dist');
const problems = [];
const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.html'));

const exists = (p) => fs.existsSync(path.join(OUT, p.replace(/^\//, '').split('#')[0] || 'index.html'));

for (const file of files) {
  const html = fs.readFileSync(path.join(OUT, file), 'utf8');
  const at = (msg) => problems.push(`${file}: ${msg}`);

  // Internal links resolve to a real file.
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//')) continue;
    const target = href === '/' ? 'index.html' : href.split('#')[0];
    if (target && !exists(target)) at(`dead link → ${href}`);
  }

  // Referenced assets exist.
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    if (!exists(m[1])) at(`missing asset → ${m[1]}`);
  }

  // Fragment targets exist on the page they point at.
  for (const m of html.matchAll(/href="(\/[^"#]*)#([^"]+)"/g)) {
    const page = m[1] === '/' ? 'index.html' : m[1].replace(/^\//, '');
    if (!exists(page)) continue;
    const target = fs.readFileSync(path.join(OUT, page), 'utf8');
    if (!target.includes(`id="${m[2]}"`)) at(`fragment #${m[2]} not found in ${page}`);
  }

  // Every <use> points at a symbol defined in the sprite.
  for (const m of html.matchAll(/<use href="#([^"]+)"/g)) {
    if (!html.includes(`id="${m[1]}"`)) at(`icon #${m[1]} is not in the sprite`);
  }

  // Images carry an alt attribute.
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt=/.test(m[0])) at(`<img> without alt: ${m[0].slice(0, 70)}…`);
  }

  // One h1, a title, and a description.
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) at(`expected exactly one <h1>, found ${h1s}`);
  if (!/<title>[^<]{10,}<\/title>/.test(html)) at('missing or short <title>');
  if (!/<meta name="description" content="[^"]{40,}"/.test(html)) at('missing or short meta description');

  // Accordion buttons must control a panel that exists.
  for (const m of html.matchAll(/aria-controls="([^"]+)"/g)) {
    if (!html.includes(`id="${m[1]}"`)) at(`aria-controls="${m[1]}" has no matching id`);
  }

  // Tags balance (a cheap guard against a broken template).
  for (const tag of ['div', 'section', 'ul', 'ol', 'table', 'form', 'article', 'figure']) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) at(`unbalanced <${tag}>: ${open} open, ${close} close`);
  }
}

// Duplicate ids within a page break both anchors and aria-controls.
for (const file of files) {
  const html = fs.readFileSync(path.join(OUT, file), 'utf8');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) problems.push(`${file}: duplicate id(s) → ${[...new Set(dupes)].join(', ')}`);
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`✓ ${files.length} pages check out — links, assets, icons, ids and headings.`);
