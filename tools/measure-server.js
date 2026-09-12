#!/usr/bin/env node
/**
 * Serves dist/ for tools/measure.js, plus a generated harness page at
 * /__measure?page=…&w=… that loads the page in an iframe of the requested
 * width. It runs as its own process because the measuring loop uses blocking
 * calls that would otherwise starve this server's event loop.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = Number(process.argv[2]) || 8199;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

const PROBE = `
function probe(win) {
  var doc = win.document.documentElement;
  var vw = doc.clientWidth;
  var bad = [];
  var all = win.document.body.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var cs = win.getComputedStyle(el);
    if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    var p = el.parentElement, pr = p ? p.getBoundingClientRect() : null;
    if (pr && pr.right > vw + 1 && Math.abs(pr.right - r.right) < 2) continue;
    var inScroller = false;
    for (var a = el.parentElement; a; a = a.parentElement) {
      var acs = win.getComputedStyle(a);
      if (acs.overflowX === 'auto' || acs.overflowX === 'scroll') { inScroller = true; break; }
    }
    if (inScroller) continue;
    bad.push(
      el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') +
      ' [' + Math.round(r.left) + '\\u2192' + Math.round(r.right) + ']'
    );
  }
  return { vw: vw, scrollWidth: doc.scrollWidth, overflow: bad.slice(0, 6) };
}
`;

const harness = (page, width) => `<!doctype html><meta charset="utf-8"><title>MEASURE:pending</title>
<style>html,body{margin:0;padding:0}iframe{display:block;width:${width}px;height:3000px;border:0}</style>
<iframe id="f" src="/${page}"></iframe>
<script>
${PROBE}
var f = document.getElementById('f');
function run() {
  try {
    var r = probe(f.contentWindow);
    r.width = ${width};
    document.title = 'MEASURE:' + JSON.stringify(r);
  } catch (e) {
    document.title = 'MEASURE:' + JSON.stringify({ error: String(e && e.message || e) });
  }
}
if (f.contentDocument && f.contentDocument.readyState === 'complete') setTimeout(run, 250);
f.addEventListener('load', function () { setTimeout(run, 250); });
</script>`;

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/__measure') {
    res.writeHead(200, { 'Content-Type': TYPES['.html'] });
    return res.end(harness(u.searchParams.get('page'), Number(u.searchParams.get('w'))));
  }
  let rel = decodeURIComponent(u.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(DIST, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('MEASURE_SERVER_READY'));
