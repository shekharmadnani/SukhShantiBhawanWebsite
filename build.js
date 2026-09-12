#!/usr/bin/env node
/**
 * Zero-dependency static site builder.
 *
 * Pages in src/pages/*.html are wrapped in src/layouts/base.html and written
 * to dist/. Templates support a deliberately small syntax:
 *
 *   {{> partial }}              include src/partials/partial.html
 *   {{ a.b.c }}                 HTML-escaped value from the context
 *   {{{ a.b.c }}}               raw value (trusted markup only)
 *   {{#each list}} … {{/each}}  loop; inside, {{field}} reads the item first,
 *                               then the outer context. {{@index}} / {{@n}}
 *                               give the 0- and 1-based position.
 *   {{#if path}} … {{/if}}      render when truthy ({{#unless}} inverts)
 *
 * Run `node build.js`. No install step, no network.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');

const site = require('./src/data/site.js');

/* ------------------------------------------------------------------ utils */

const read = (p) => fs.readFileSync(p, 'utf8');

const escapeHtml = (v) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

/** Resolve "a.b.c" against a stack of scopes, innermost first. */
function lookup(scopes, expr) {
  const key = expr.trim();
  if (key === '.') return scopes[0];
  const [head, ...rest] = key.split('.');
  for (const scope of scopes) {
    if (scope == null || typeof scope !== 'object') continue;
    if (!(head in scope)) continue;
    let value = scope[head];
    for (const part of rest) {
      if (value == null) break;
      value = value[part];
    }
    return value;
  }
  return undefined;
}

/* --------------------------------------------------------------- renderer */

/**
 * Find the {{/name}} that closes the block opened at `from`, accounting for
 * nested blocks of the same name.
 */
function findClose(tpl, name, from) {
  const re = new RegExp(`\\{\\{(#${name}|/${name})\\b[^}]*\\}\\}`, 'g');
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(tpl))) {
    depth += m[1][0] === '#' ? 1 : -1;
    if (depth === 0) return { start: m.index, end: re.lastIndex };
  }
  throw new Error(`Unclosed {{#${name}}} block`);
}

function render(tpl, scopes) {
  // Blocks first, so their bodies are rendered with the right scope.
  const block = /\{\{#(each|if|unless)\s+([^}]+?)\s*\}\}/;
  let m;
  while ((m = block.exec(tpl))) {
    const [tag, kind, expr] = m;
    const bodyStart = m.index + tag.length;
    const close = findClose(tpl, kind, bodyStart);
    const body = tpl.slice(bodyStart, close.start);
    const value = lookup(scopes, expr);
    let out = '';

    if (kind === 'each') {
      const list = Array.isArray(value) ? value : [];
      out = list
        .map((item, i) => {
          const item_ = typeof item === 'object' && item !== null ? item : { value: item };
          return render(body, [{ ...item_, '@index': i, '@n': i + 1, '@first': i === 0 }, ...scopes]);
        })
        .join('');
    } else {
      const truthy = Array.isArray(value) ? value.length > 0 : Boolean(value);
      if (kind === 'if' ? truthy : !truthy) out = render(body, scopes);
    }

    tpl = tpl.slice(0, m.index) + out + tpl.slice(close.end);
  }

  // Then interpolation. Raw ({{{ }}}) before escaped ({{ }}).
  tpl = tpl.replace(/\{\{\{\s*([^}]+?)\s*\}\}\}/g, (_, e) => {
    const v = lookup(scopes, e);
    return v == null ? '' : String(v);
  });
  tpl = tpl.replace(/\{\{\s*([^#/>{][^}]*?)\s*\}\}/g, (_, e) => {
    const v = lookup(scopes, e);
    return v == null ? '' : escapeHtml(v);
  });

  return tpl;
}

/** Inline {{> partial }} includes before rendering, so partials see the scope. */
function inlinePartials(tpl, depth = 0) {
  if (depth > 12) throw new Error('Partial include loop');
  return tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    const file = path.join(SRC, 'partials', `${name}.html`);
    if (!fs.existsSync(file)) throw new Error(`Missing partial: ${name}`);
    return inlinePartials(read(file), depth + 1);
  });
}

/* ------------------------------------------------------------------ pages */

/** Pages start with an HTML comment holding JSON front-matter. */
function parsePage(raw, file) {
  const m = raw.match(/^\s*<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error(`${file}: missing <!--meta … --> front-matter`);
  let meta;
  try {
    meta = JSON.parse(m[1]);
  } catch (err) {
    throw new Error(`${file}: front-matter is not valid JSON — ${err.message}`);
  }
  return { meta, body: raw.slice(m[0].length) };
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const layout = inlinePartials(read(path.join(SRC, 'layouts', 'base.html')));
  const pageFiles = fs
    .readdirSync(path.join(SRC, 'pages'))
    .filter((f) => f.endsWith('.html'))
    .sort();

  const pages = pageFiles.map((file) => {
    const { meta, body } = parsePage(read(path.join(SRC, 'pages', file)), file);
    return { file, url: file === 'index.html' ? '/' : `/${file}`, meta, body };
  });

  for (const page of pages) {
    // Mark the active nav item for this page.
    const nav = site.nav.map((item) => ({ ...item, active: item.id === page.meta.nav }));
    const ctx = {
      ...page.meta,
      site,
      nav,
      page: { ...page.meta, url: page.url, file: page.file },
      canonical: site.url.replace(/\/$/, '') + (page.url === '/' ? '/' : page.url),
      ogImage: site.url.replace(/\/$/, '') + (page.meta.image || '/assets/img/og-default.png'),
    };

    const content = render(inlinePartials(page.body), [ctx]);
    const html = render(layout, [{ ...ctx, content }]);
    fs.writeFileSync(path.join(OUT, page.file), html);
    console.log(`  ✓ ${page.file}`);
  }

  copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));

  // sitemap.xml / robots.txt
  const base = site.url.replace(/\/$/, '');
  const urls = pages
    .map((p) => `  <url><loc>${base}${p.url}</loc><changefreq>monthly</changefreq></url>`)
    .join('\n');
  fs.writeFileSync(
    path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
  fs.writeFileSync(
    path.join(OUT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`
  );
  // GitHub Pages: don't run the output through Jekyll.
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  // Any unknown path falls back to the 404 page on most static hosts.
  console.log(`\nBuilt ${pages.length} pages → dist/`);
}

try {
  build();
} catch (err) {
  console.error(`\nBuild failed: ${err.message}\n`);
  process.exit(1);
}
