#!/usr/bin/env node
/**
 * Horizontal-overflow check: renders every built page at a range of widths and
 * reports any element sticking out past the viewport — the usual cause of a
 * page that scrolls sideways on a phone.
 *
 *   node tools/measure.js [width ...]     (default: 320 390 768 1024 1440)
 *
 * Chromium will not open a window narrower than 500px, so each page is loaded
 * into an iframe of the target width inside a wider window. Chromium also has
 * no "run this script and tell me the answer" flag, so the probe writes its
 * result into <title> and we read it back out of --dump-dom.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const CHROME =
  process.env.CHROME_PATH ||
  ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome']
    .find((p) => fs.existsSync(p));

if (!CHROME) {
  console.error('No Chromium found. Set CHROME_PATH to run this check.');
  process.exit(2);
}

/* Keep the browser offline: the webfont link and Chromium's own update pings
   would otherwise stall every run. Fonts fall back to the stacks declared in
   the stylesheet, which is what a visitor on a slow connection sees anyway. */
const FLAGS = [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-background-networking', '--disable-component-update',
  '--disable-sync', '--disable-default-apps', '--disable-extensions',
  '--host-resolver-rules=MAP * 127.0.0.1:9, EXCLUDE localhost',
];

const DIST = path.join(__dirname, '..', 'dist');
const args = process.argv.slice(2).map(Number).filter(Boolean);
const WIDTHS = args.length ? args : [320, 390, 768, 1024, 1440];
const PORT = 8199;

const server = spawn(process.execPath, [path.join(__dirname, 'measure-server.js'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});

const done = (code) => { server.kill(); process.exit(code); };

server.stdout.once('data', () => {
  const pages = fs.readdirSync(DIST).filter((f) => f.endsWith('.html'));
  let failures = 0;

  for (const width of WIDTHS) {
    const offenders = [];
    for (const page of pages) {
      let dom;
      try {
        dom = execFileSync(
          CHROME,
          [...FLAGS, `--window-size=${Math.max(width + 80, 600)},1200`,
           '--virtual-time-budget=5000', '--dump-dom',
           `http://localhost:${PORT}/__measure?page=${page}&w=${width}`],
          { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }
        );
      } catch (err) {
        offenders.push(`${page} — chromium failed: ${err.message.split('\n')[0]}`);
        failures++;
        continue;
      }

      const m = dom.match(/<title>MEASURE:(.*?)<\/title>/s);
      if (!m || m[1] === 'pending') { offenders.push(`${page} — probe did not run`); failures++; continue; }

      const r = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'"));
      if (r.error) { offenders.push(`${page} — ${r.error}`); failures++; continue; }
      if (r.vw !== width) { offenders.push(`${page} — measured ${r.vw}px, expected ${width}px`); failures++; continue; }
      if (r.scrollWidth > r.vw + 1 || r.overflow.length) {
        failures++;
        offenders.push(`${page} — content reaches ${r.scrollWidth}px in a ${r.vw}px viewport\n        ` +
          r.overflow.join('\n        '));
      }
    }
    console.log(offenders.length
      ? `  ✗ ${width}px\n      ${offenders.join('\n      ')}`
      : `  ✓ ${width}px — all ${pages.length} pages fit`);
  }

  if (failures) {
    console.error(`\n✗ ${failures} page/width combination(s) overflow horizontally.\n`);
    return done(1);
  }
  console.log(`\n✓ No horizontal overflow across ${pages.length} pages × ${WIDTHS.length} widths.`);
  done(0);
});
