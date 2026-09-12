#!/usr/bin/env node
/**
 * Packages dist/ into .artifact/ for publishing as a shareable preview.
 *
 * Three differences from the real build:
 *   1. Root-relative URLs (/about.html, /assets/…) become relative, because
 *      the artifact host does not serve paths with a leading slash.
 *   2. Canonical, Open Graph and JSON-LD tags are stripped, so a preview
 *      carrying placeholder contact details can never present itself as the
 *      centre's real site.
 *   3. index.html is reduced to a fragment — the host supplies the doctype,
 *      <head> and <body> for the entry page.
 *
 *   node tools/make-artifact.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, '.artifact');

/** /about.html → about.html, /assets/x → assets/x, / → index.html */
function relativise(html) {
  return html
    .replace(/(href|src)="\/"/g, '$1="index.html"')
    .replace(/(href|src)="\/(?!\/)([^"]*)"/g, '$1="$2"');
}

/** Remove anything that asserts this is the live site. */
function deIdentify(html) {
  return html
    .replace(/\s*<link rel="canonical"[^>]*>/g, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^>]*>/g, '')
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
};
copyDir(path.join(DIST, 'assets'), path.join(OUT, 'assets'));

const pages = fs.readdirSync(DIST).filter((f) => f.endsWith('.html'));
for (const page of pages) {
  let html = deIdentify(relativise(fs.readFileSync(path.join(DIST, page), 'utf8')));

  if (page === 'index.html') {
    // The host wraps the entry page in its own skeleton, so hand it a fragment:
    // head contents first (a <link> and <title> are valid in body flow), then
    // the page markup.
    html = html
      .replace(/<!doctype html>\s*/i, '')
      .replace(/<html[^>]*>\s*/i, '')
      .replace(/<\/html>\s*$/i, '')
      .replace(/<\/?head>\s*/gi, '')
      .replace(/<\/?body>\s*/gi, '')
      .replace(/\s*<meta charset="utf-8">/i, '')
      .replace(/\s*<meta name="viewport"[^>]*>/i, '')
      // The artifact's name in the gallery, rather than the page's SEO title.
      .replace(/<title>[^<]*<\/title>/i, '<title>Sukh Shanti Bhawan</title>');
  }

  fs.writeFileSync(path.join(OUT, page), html);
}

console.log(`Packaged ${pages.length} pages → .artifact/`);
