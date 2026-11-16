#!/usr/bin/env node
/**
 * Promo maker — local editing app.
 *
 *   node promo/server.js [workspace] [--port 8090]
 *   then open http://localhost:8090
 *
 * Everything lives in the workspace folder (default promo/workspace):
 *   media/        imported images, videos, music, logos
 *   promo.json    the promo being edited (saved automatically)
 *   templates/    promos saved for reuse
 *   out/          rendered previews and exports
 *
 * Plain Node, no dependencies. FFmpeg and ffprobe must be on PATH.
 * It binds to 127.0.0.1 only: this is a tool for your own computer.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { render, prepare, probe, kindOf } = require('./render');

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const PORT = Number(portIdx >= 0 ? args[portIdx + 1] : process.env.PORT) || 8090;
const WS = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port') || path.join(__dirname, 'workspace'));
const MEDIA = path.join(WS, 'media');
const OUT = path.join(WS, 'out');
const USER_TEMPLATES = path.join(WS, 'templates');
const BUILTIN_TEMPLATES = path.join(__dirname, 'templates');
const PROMO = path.join(WS, 'promo.json');
for (const d of [MEDIA, OUT, USER_TEMPLATES]) fs.mkdirSync(d, { recursive: true });
// A new workspace starts from the event template. Its steps keep their types
// and settings, but any file not actually in media/ is left for the user to choose.
if (!fs.existsSync(PROMO)) {
  const t = JSON.parse(fs.readFileSync(path.join(BUILTIN_TEMPLATES, 'bk-event.json'), 'utf8'));
  const have = (f) => f && fs.existsSync(path.join(MEDIA, f));
  for (const c of t.clips) if (!have(c.file)) c.file = '';
  if (t.music && !have(t.music.file)) delete t.music;
  if (t.logo && !have(t.logo.file)) delete t.logo;
  fs.writeFileSync(PROMO, JSON.stringify(t, null, 2));
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
  '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.opus': 'audio/ogg',
};

/** Keep uploaded names readable but safe: no paths, no odd characters. */
const safeName = (n) => path.basename(String(n)).normalize('NFC').replace(/[^\p{L}\p{N}._ -]+/gu, '_').replace(/^\.+/, '').slice(0, 120);
const inside = (dir, name) => { const p = path.resolve(dir, name); return p.startsWith(dir + path.sep) ? p : null; };

const json = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const readBody = (req, limit = 5e6) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

/** Static files with Range support — the browser needs it to scrub videos. */
function sendFile(req, res, file) {
  let st;
  try { st = fs.statSync(file); } catch { res.writeHead(404); return res.end('Not found'); }
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : st.size - 1;
    start = Math.max(0, start); end = Math.min(end, st.size - 1);
    if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ----------------------------------------------------------- media info --- */

const probeCache = new Map();
function mediaInfo(name) {
  const file = path.join(MEDIA, name);
  const st = fs.statSync(file);
  const key = `${name}:${st.size}:${st.mtimeMs}`;
  if (!probeCache.has(key)) {
    let info = { kind: kindOf(name) };
    try { info = probe(file); } catch { info.error = 'FFmpeg could not read this file'; }
    probeCache.set(key, { name, size: st.size, ...info });
  }
  return probeCache.get(key);
}
const listMedia = () => fs.readdirSync(MEDIA).filter((f) => !f.startsWith('.') && kindOf(f)).sort().map(mediaInfo);

function listTemplates() {
  const read = (dir, source) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => f.endsWith('.json')).map((f) => {
    let title = f;
    try { title = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).name || f; } catch { /* keep file name */ }
    return { id: `${source}/${f}`, title, source };
  });
  return [...read(BUILTIN_TEMPLATES, 'built-in'), ...read(USER_TEMPLATES, 'saved')];
}

/* --------------------------------------------------------------- render --- */

let job = { state: 'idle' };
function startRender(preview) {
  if (job.state === 'running') return false;
  const template = JSON.parse(fs.readFileSync(PROMO, 'utf8'));
  const outName = preview ? 'preview.mp4' : `promo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.mp4`;
  job = { state: 'running', preview, progress: 0, stage: 'Starting', started: Date.now() };
  const current = job;
  render(template, {
    baseDir: WS, preview, out: path.join(OUT, outName),
    onProgress: (f, stage) => { current.progress = f; current.stage = stage; },
  }).then((r) => {
    Object.assign(current, { state: 'done', progress: 1, stage: 'Done', output: `/out/${outName}`,
      file: r.file, duration: r.duration, size: `${r.width}×${r.height}`, seconds: (Date.now() - current.started) / 1000 });
  }).catch((e) => {
    Object.assign(current, { state: 'error', error: e.message, problems: e.problems || null });
  });
  return true;
}

/* --------------------------------------------------------------- routes --- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/' || p === '/index.html') return sendFile(req, res, path.join(__dirname, 'ui', 'index.html'));

    if (p.startsWith('/media/')) {
      const f = inside(MEDIA, p.slice(7));
      return f ? sendFile(req, res, f) : json(res, 400, { error: 'Bad path' });
    }
    if (p.startsWith('/out/')) {
      const f = inside(OUT, p.slice(5));
      return f ? sendFile(req, res, f) : json(res, 400, { error: 'Bad path' });
    }

    if (p === '/api/project' && req.method === 'GET') {
      return json(res, 200, JSON.parse(fs.readFileSync(PROMO, 'utf8')));
    }
    if (p === '/api/project' && req.method === 'PUT') {
      const body = JSON.parse(await readBody(req));
      fs.writeFileSync(PROMO + '.tmp', JSON.stringify(body, null, 2));
      fs.renameSync(PROMO + '.tmp', PROMO);
      return json(res, 200, { ok: true });
    }
    if (p === '/api/validate') {
      const template = JSON.parse(fs.readFileSync(PROMO, 'utf8'));
      const { promo, problems } = prepare(template, WS);
      return json(res, 200, { problems, total: promo.total, durations: promo.clips.map((c) => c.duration || 0) });
    }

    if (p === '/api/media' && req.method === 'GET') return json(res, 200, listMedia());
    if (p.startsWith('/api/media/') && req.method === 'POST') {
      // Raw upload: the body is the file. Never overwrite — add a number instead.
      let name = safeName(p.slice(11));
      if (!name || !kindOf(name)) return json(res, 400, { error: 'Only images, videos and audio files can be imported.' });
      const ext = path.extname(name), stem = name.slice(0, -ext.length);
      for (let i = 2; fs.existsSync(path.join(MEDIA, name)); i++) name = `${stem}-${i}${ext}`;
      const dest = path.join(MEDIA, name);
      const tmp = dest + '.part';
      await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(tmp);
        req.pipe(w); w.on('finish', resolve); w.on('error', reject); req.on('error', reject);
      });
      fs.renameSync(tmp, dest);
      return json(res, 200, mediaInfo(name));
    }
    if (p.startsWith('/api/media/') && req.method === 'DELETE') {
      const f = inside(MEDIA, p.slice(11));
      if (f && fs.existsSync(f)) fs.unlinkSync(f);
      return json(res, 200, { ok: true });
    }

    if (p === '/api/templates' && req.method === 'GET') return json(res, 200, listTemplates());
    if (p.startsWith('/api/templates/') && req.method === 'GET') {
      const [source, f] = p.slice(15).split('/');
      const dir = source === 'built-in' ? BUILTIN_TEMPLATES : USER_TEMPLATES;
      const file = f && inside(dir, f);
      return file && fs.existsSync(file) ? json(res, 200, JSON.parse(fs.readFileSync(file, 'utf8'))) : json(res, 404, { error: 'No such template' });
    }
    if (p === '/api/templates' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const title = String(body.name || 'Untitled').slice(0, 80);
      const f = `${safeName(title).replace(/\s+/g, '-').toLowerCase() || 'template'}.json`;
      fs.writeFileSync(path.join(USER_TEMPLATES, f), JSON.stringify({ ...body, name: title }, null, 2));
      return json(res, 200, { id: `saved/${f}` });
    }

    if (p === '/api/render' && req.method === 'POST') {
      const ok = startRender(url.searchParams.get('preview') === '1');
      return json(res, ok ? 200 : 409, ok ? { ok } : { error: 'A render is already running.' });
    }
    if (p === '/api/render') return json(res, 200, job);

    res.writeHead(404); res.end('Not found');
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use — most likely an older Promo Maker is still running`);
    console.error('in another terminal window. Close that window (or press Ctrl+C in it), then run this again.');
    console.error(`Or start this one on another port:  node promo/server.js --port ${PORT + 1}\n`);
    process.exit(1);
  }
  throw e;
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Promo Maker v3: http://localhost:${PORT}`);
  console.log(`Workspace:   ${WS}`);
});
