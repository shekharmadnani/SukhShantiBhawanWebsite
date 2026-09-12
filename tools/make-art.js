#!/usr/bin/env node
/**
 * Generates the site's artwork into src/assets/img/.
 *
 * These are original, parametric compositions — mandala rings, lotus forms,
 * a rising sun — drawn in the site's palette. They are deliberately abstract
 * so the site looks finished today; replace any of them with a real photograph
 * of the centre by dropping a file with the same name into src/assets/img/.
 *
 *   node tools/make-art.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'src', 'assets', 'img');
fs.mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------- palettes -- */
const PALETTES = {
  night: { from: '#071f27', to: '#0e3f4e', glow: '#d2a24a', ink: '#e3c177', accent: '#6aa8b3' },
  dawn: { from: '#0e3f4e', to: '#a97620', glow: '#f4e4c2', ink: '#f4e4c2', accent: '#e3c177' },
  teal: { from: '#0a2e3a', to: '#1d6d7e', glow: '#6aa8b3', ink: '#e3c177', accent: '#f4e4c2' },
  paper: { from: '#f6efe3', to: '#efe5d4', glow: '#ffffff', ink: '#a97620', accent: '#145566' },
  ember: { from: '#0a2e3a', to: '#8a5a18', glow: '#f4e4c2', ink: '#f4e4c2', accent: '#d2a24a' },
  sage: { from: '#0e3f4e', to: '#2b6b62', glow: '#cfe3d8', ink: '#e3c177', accent: '#cfe3d8' },
};

/* Small deterministic RNG so every run produces identical files. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const round = (n) => Math.round(n * 100) / 100;

/* --------------------------------------------------------------- shapes -- */

/** A single petal pointing up from the origin. */
function petal(r0, r1, width) {
  const w = width;
  return [
    `M0 ${round(-r0)}`,
    `C${round(w)} ${round(-r0 - (r1 - r0) * 0.3)} ${round(w * 0.72)} ${round(-r1 * 0.78)} 0 ${round(-r1)}`,
    `C${round(-w * 0.72)} ${round(-r1 * 0.78)} ${round(-w)} ${round(-r0 - (r1 - r0) * 0.3)} 0 ${round(-r0)}`,
    'Z',
  ].join(' ');
}

/** A ring of petals around (cx, cy). */
function petalRing(cx, cy, count, r0, r1, width, attrs, offset = 0) {
  const d = petal(r0, r1, width);
  let out = `<g transform="translate(${round(cx)} ${round(cy)})" ${attrs}>`;
  for (let i = 0; i < count; i++) {
    out += `<path d="${d}" transform="rotate(${round((360 / count) * i + offset)})"/>`;
  }
  return out + '</g>';
}

/** Radiating hairlines. */
function rays(cx, cy, count, r0, r1, attrs, offset = 0) {
  let out = `<g transform="translate(${round(cx)} ${round(cy)})" ${attrs}>`;
  for (let i = 0; i < count; i++) {
    const a = ((360 / count) * i + offset) * (Math.PI / 180);
    out +=
      `<line x1="${round(Math.cos(a) * r0)}" y1="${round(Math.sin(a) * r0)}" ` +
      `x2="${round(Math.cos(a) * r1)}" y2="${round(Math.sin(a) * r1)}"/>`;
  }
  return out + '</g>';
}

/** Concentric circles. */
function ripples(cx, cy, count, r0, step, attrs) {
  let out = `<g ${attrs}>`;
  for (let i = 0; i < count; i++) {
    out += `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r0 + step * i)}" fill="none"/>`;
  }
  return out + '</g>';
}

/** A seated, meditating figure — simple enough to read at any size. */
function figure(cx, baseY, scale, fill) {
  const s = scale;
  return (
    `<g transform="translate(${round(cx)} ${round(baseY)}) scale(${round(s)})" fill="${fill}">` +
    `<circle cx="0" cy="-86" r="21"/>` +
    `<path d="M0 -66c-20 0-33 16-37 36l-8 38c-2 10 4 16 12 16h66c8 0 14-6 12-16l-8-38c-4-20-17-36-37-36z"/>` +
    `<path d="M-58 24h116c7 0 11 5 8 11-9 17-33 27-66 27s-57-10-66-27c-3-6 1-11 8-11z"/>` +
    `</g>`
  );
}

/** A lamp flame. */
function diya(cx, cy, scale, warm, cool) {
  const s = scale;
  return (
    `<g transform="translate(${round(cx)} ${round(cy)}) scale(${round(s)})">` +
    `<path d="M0 -54c14 18 21 31 21 43a21 21 0 0 1-42 0c0-12 7-25 21-43z" fill="${warm}"/>` +
    `<path d="M0 -28c6 9 9 16 9 22a9 9 0 0 1-18 0c0-6 3-13 9-22z" fill="${cool}" opacity=".75"/>` +
    `<path d="M-34 6h68c4 0 6 3 5 7-4 13-18 21-39 21S-35 26-39 13c-1-4 1-7 5-7z" fill="${warm}" opacity=".85"/>` +
    `</g>`
  );
}

/* ---------------------------------------------------------------- scene -- */
function scene({ w, h, palette, motif, seed = 7, title }) {
  const p = PALETTES[palette];
  const r = rng(seed);
  const id = `g${seed}`;
  const light = palette === 'paper';

  // Focal point of the composition.
  const fx = w * (motif === 'sunrise' ? 0.5 : 0.68);
  const fy = h * (motif === 'sunrise' ? 0.62 : 0.38);
  const unit = Math.min(w, h);

  let body = '';

  if (motif === 'sunrise' || motif === 'mandala' || motif === 'lotus') {
    body += ripples(fx, fy, 7, unit * 0.2, unit * 0.085, `stroke="${p.ink}" stroke-width="1" opacity=".16"`);
    body += rays(fx, fy, 48, unit * 0.21, unit * 0.62, `stroke="${p.ink}" stroke-width="1" opacity=".13"`);
    body += petalRing(fx, fy, 16, unit * 0.2, unit * 0.42, unit * 0.05, `fill="${p.ink}" opacity=".13"`);
    body += petalRing(fx, fy, 8, unit * 0.14, unit * 0.28, unit * 0.052, `fill="${p.ink}" opacity=".2"`, 22);
    body += `<circle cx="${round(fx)}" cy="${round(fy)}" r="${round(unit * 0.13)}" fill="${p.glow}" opacity="${light ? 0.5 : 0.85}"/>`;
    body += `<circle cx="${round(fx)}" cy="${round(fy)}" r="${round(unit * 0.13)}" fill="none" stroke="${p.ink}" stroke-width="1.5" opacity=".5"/>`;
  }

  if (motif === 'sunrise' || motif === 'lotus') {
    // Lotus opening along the lower edge.
    const ly = h * 0.99;
    body += petalRing(w * 0.5, ly, 9, unit * 0.04, unit * 0.34, unit * 0.07, `fill="${p.ink}" opacity=".18"`, 180);
    body += `<g transform="translate(${round(w * 0.5)} ${round(ly)}) rotate(180)">`;
    for (const [rot, sc, op] of [[-46, 0.86, 0.3], [-22, 1, 0.36], [0, 1.1, 0.42], [22, 1, 0.36], [46, 0.86, 0.3]]) {
      body += `<path d="${petal(unit * 0.03, unit * 0.3 * sc, unit * 0.078)}" transform="rotate(${rot})" fill="${p.ink}" opacity="${op}"/>`;
    }
    body += '</g>';
  }

  if (motif === 'figure') {
    body += ripples(fx, fy, 6, unit * 0.24, unit * 0.09, `stroke="${p.ink}" stroke-width="1" opacity=".18"`);
    body += petalRing(fx, fy, 12, unit * 0.24, unit * 0.46, unit * 0.055, `fill="${p.ink}" opacity=".12"`);
    body += `<circle cx="${round(fx)}" cy="${round(fy - unit * 0.16)}" r="${round(unit * 0.09)}" fill="${p.glow}" opacity=".7"/>`;
    body += figure(fx, fy + unit * 0.22, unit / 320, p.ink);
  }

  if (motif === 'diya') {
    body += ripples(fx, fy, 6, unit * 0.18, unit * 0.08, `stroke="${p.ink}" stroke-width="1" opacity=".16"`);
    body += rays(fx, fy, 32, unit * 0.2, unit * 0.55, `stroke="${p.glow}" stroke-width="1" opacity=".14"`);
    body += `<circle cx="${round(fx)}" cy="${round(fy)}" r="${round(unit * 0.16)}" fill="${p.glow}" opacity=".28"/>`;
    body += diya(fx, fy, unit / 240, p.ink, p.glow);
    for (let i = 0; i < 5; i++) {
      const dx = fx + (r() - 0.5) * w * 0.7;
      const dy = fy + (r() - 0.3) * h * 0.4;
      body += diya(dx, dy, (unit / 240) * 0.3, p.ink, p.glow) .replace('">', '" opacity=".45">');
    }
  }

  if (motif === 'waves') {
    for (let i = 0; i < 9; i++) {
      const y = h * (0.28 + i * 0.075);
      const amp = h * 0.035 * (1 - i / 14);
      body +=
        `<path d="M0 ${round(y)} Q ${round(w * 0.25)} ${round(y - amp)} ${round(w * 0.5)} ${round(y)} ` +
        `T ${round(w)} ${round(y)}" fill="none" stroke="${p.ink}" stroke-width="1" opacity="${round(0.3 - i * 0.025)}"/>`;
    }
    body += petalRing(w * 0.5, h * 0.24, 12, unit * 0.06, unit * 0.2, unit * 0.035, `fill="${p.ink}" opacity=".22"`);
    body += `<circle cx="${round(w * 0.5)}" cy="${round(h * 0.24)}" r="${round(unit * 0.055)}" fill="${p.glow}" opacity=".8"/>`;
  }

  if (motif === 'lattice') {
    // A jali screen — the kind of carved lattice found in temple architecture.
    const step = unit * 0.11;
    body += `<g stroke="${p.ink}" stroke-width="1" fill="none" opacity=".24">`;
    for (let y = -step; y < h + step; y += step) {
      for (let x = -step; x < w + step; x += step) {
        body += `<circle cx="${round(x)}" cy="${round(y)}" r="${round(step * 0.5)}"/>`;
      }
    }
    body += '</g>';
    body += petalRing(fx, fy, 8, unit * 0.1, unit * 0.26, unit * 0.06, `fill="${p.glow}" opacity=".3"`);
    body += `<circle cx="${round(fx)}" cy="${round(fy)}" r="${round(unit * 0.09)}" fill="${p.glow}" opacity=".55"/>`;
  }

  // A few drifting motes for depth.
  let motes = '';
  for (let i = 0; i < 26; i++) {
    motes +=
      `<circle cx="${round(r() * w)}" cy="${round(r() * h)}" r="${round(0.6 + r() * 2.1)}" ` +
      `fill="${p.glow}" opacity="${round(0.08 + r() * 0.22)}"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"${
      title ? ` aria-label="${title}"` : ''
    }>` +
    (title ? `<title>${title}</title>` : '') +
    `<defs>` +
    `<linearGradient id="bg${id}" x1="0" y1="0" x2="0.4" y2="1">` +
    `<stop offset="0" stop-color="${p.from}"/><stop offset="1" stop-color="${p.to}"/></linearGradient>` +
    `<radialGradient id="gl${id}" cx="${round(fx / w)}" cy="${round(fy / h)}" r="0.75">` +
    `<stop offset="0" stop-color="${p.glow}" stop-opacity="${light ? 0.7 : 0.42}"/>` +
    `<stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>` +
    `<filter id="gr${id}" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="${seed}"/>` +
    `<feColorMatrix type="saturate" values="0"/></filter>` +
    `<clipPath id="cp${id}"><rect width="${w}" height="${h}"/></clipPath>` +
    `</defs>` +
    `<g clip-path="url(#cp${id})">` +
    `<rect width="${w}" height="${h}" fill="url(#bg${id})"/>` +
    `<rect width="${w}" height="${h}" fill="url(#gl${id})"/>` +
    body +
    motes +
    `<rect width="${w}" height="${h}" filter="url(#gr${id})" opacity="${light ? 0.05 : 0.07}"/>` +
    `</g></svg>\n`
  );
}

/* ------------------------------------------------------------ PNG writer -- */
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(file, width, height, shade) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  let prev = Buffer.alloc(stride);
  let row = Buffer.alloc(stride);
  let o = 0;

  const clamp = (n) => (n < 0 ? 0 : n > 255 ? 255 : Math.round(n));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = shade(x / width, y / height);
      row[x * 3] = clamp(r);
      row[x * 3 + 1] = clamp(g);
      row[x * 3 + 2] = clamp(b);
    }

    // Paeth filtering: a smooth gradient predicts almost perfectly, so the
    // residuals deflate to a fraction of the unfiltered size.
    raw[o++] = 4;
    for (let i = 0; i < stride; i++) {
      const a = i >= 3 ? row[i - 3] : 0;
      const b = prev[i];
      const c = i >= 3 ? prev[i - 3] : 0;
      const pp = a + b - c;
      const pa = Math.abs(pp - a);
      const pb = Math.abs(pp - b);
      const pc = Math.abs(pp - c);
      const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      raw[o++] = (row[i] - pred) & 0xff;
    }

    const swap = prev;
    prev = row;
    row = swap;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // truecolour
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  );
}

/** The social share card: a sun over mandala rings, drawn per-pixel. */
function makeOgCard() {
  const W = 1200;
  const H = 630;
  const cx = 0.68;
  const cy = 0.42;
  const aspect = W / H;
  const noise = rng(31);
  const grain = new Float32Array(64 * 64);
  for (let i = 0; i < grain.length; i++) grain[i] = noise() - 0.5;

  writePng(path.join(OUT, 'og-default.png'), W, H, (u, v) => {
    // Vertical base gradient: deep-900 → deep-700.
    const t = v * 0.75 + u * 0.25;
    let r = 7 + (14 - 7) * t;
    let g = 31 + (63 - 31) * t;
    let b = 39 + (78 - 39) * t;

    const dx = (u - cx) * aspect;
    const dy = v - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ang = Math.atan2(dy, dx);

    // Warm glow.
    const glow = Math.exp(-Math.pow(dist / 0.42, 2));
    r += 190 * glow * 0.55;
    g += 150 * glow * 0.42;
    b += 70 * glow * 0.2;

    // Sun disc with a soft edge.
    const disc = 1 - smooth(0.115, 0.128, dist);
    r += 150 * disc; g += 120 * disc; b += 55 * disc;

    // Concentric rings.
    const ring = Math.pow(Math.max(0, Math.cos((dist - 0.115) * Math.PI * 2 / 0.062)), 24) *
      (1 - smooth(0.14, 0.62, dist));
    r += 120 * ring; g += 96 * ring; b += 48 * ring;

    // Petal rays: angular modulation fading outward.
    const petals = Math.pow(Math.max(0, Math.cos(ang * 16)), 6) *
      smooth(0.12, 0.2, dist) * (1 - smooth(0.25, 0.7, dist));
    r += 80 * petals; g += 62 * petals; b += 30 * petals;

    // Vignette, plus a low-frequency mottle. Sampling the noise every fourth
    // pixel keeps it from becoming per-pixel grain, which PNG cannot compress.
    const vig = 1 - 0.5 * Math.pow(Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2, 2.4);
    const n = grain[((((v * H) / 4) | 0) % 64) * 64 + ((((u * W) / 4) | 0) % 64)] * 1.6;
    return [r * vig + n, g * vig + n, b * vig + n];
  });

  function smooth(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
}

/* ---------------------------------------------------------------- build -- */
const SPECS = [
  { file: 'hero', w: 1600, h: 900, palette: 'night', motif: 'sunrise', seed: 3, title: 'Sunrise over a lotus' },
  { file: 'hero-page', w: 1600, h: 560, palette: 'night', motif: 'mandala', seed: 11, title: 'Mandala at dawn' },
  { file: 'cta-band', w: 1600, h: 600, palette: 'teal', motif: 'lattice', seed: 19, title: 'Carved lattice screen' },
  { file: 'welcome', w: 900, h: 1120, palette: 'dawn', motif: 'lotus', seed: 5, title: 'Lotus in first light' },
  { file: 'meditation', w: 1200, h: 900, palette: 'night', motif: 'figure', seed: 23, title: 'A figure in meditation' },
  { file: 'about-centre', w: 1100, h: 820, palette: 'paper', motif: 'mandala', seed: 41, title: 'Mandala in daylight' },
  { file: 'about-org', w: 1100, h: 820, palette: 'sage', motif: 'waves', seed: 43, title: 'Still water' },
  { file: 'services', w: 1200, h: 800, palette: 'teal', motif: 'mandala', seed: 47, title: 'Radiating mandala' },
  { file: 'visit', w: 1100, h: 820, palette: 'dawn', motif: 'lattice', seed: 53, title: 'Doorway lattice' },

  { file: 'course-foundation', w: 900, h: 620, palette: 'dawn', motif: 'sunrise', seed: 61, title: 'Sunrise' },
  { file: 'course-positive', w: 800, h: 500, palette: 'sage', motif: 'waves', seed: 67, title: 'Calm water' },
  { file: 'course-stress', w: 800, h: 500, palette: 'teal', motif: 'waves', seed: 71, title: 'Settling ripples' },
  { file: 'course-leadership', w: 800, h: 500, palette: 'night', motif: 'mandala', seed: 73, title: 'Mandala' },
  { file: 'course-anger', w: 800, h: 500, palette: 'ember', motif: 'diya', seed: 79, title: 'A steady flame' },
  { file: 'course-values', w: 800, h: 500, palette: 'paper', motif: 'lattice', seed: 83, title: 'Lattice pattern' },

  { file: 'event-shiv', w: 800, h: 500, palette: 'night', motif: 'diya', seed: 89, title: 'Lamps in the dark' },
  { file: 'event-yoga', w: 800, h: 500, palette: 'sage', motif: 'figure', seed: 97, title: 'Meditation at sunrise' },
  { file: 'event-raksha', w: 800, h: 500, palette: 'dawn', motif: 'lotus', seed: 101, title: 'Lotus' },
  { file: 'event-diwali', w: 800, h: 500, palette: 'ember', motif: 'diya', seed: 103, title: 'Festival lamps' },

  { file: 'gallery-1', w: 900, h: 675, palette: 'night', motif: 'mandala', seed: 107, title: 'The meditation hall' },
  { file: 'gallery-2', w: 900, h: 1350, palette: 'dawn', motif: 'lotus', seed: 109, title: 'Morning at the centre' },
  { file: 'gallery-3', w: 900, h: 675, palette: 'teal', motif: 'figure', seed: 113, title: 'A class in progress' },
  { file: 'gallery-4', w: 900, h: 675, palette: 'ember', motif: 'diya', seed: 127, title: 'Festival evening' },
  { file: 'gallery-5', w: 900, h: 1350, palette: 'sage', motif: 'waves', seed: 131, title: 'The garden' },
  { file: 'gallery-6', w: 900, h: 675, palette: 'paper', motif: 'lattice', seed: 137, title: 'The entrance' },
  { file: 'gallery-7', w: 900, h: 675, palette: 'dawn', motif: 'sunrise', seed: 139, title: 'Amrit Vela' },
  { file: 'gallery-8', w: 900, h: 675, palette: 'night', motif: 'lotus', seed: 149, title: 'A quiet corner' },
];

for (const spec of SPECS) {
  fs.writeFileSync(path.join(OUT, `${spec.file}.svg`), scene(spec));
}
makeOgCard();

console.log(`Generated ${SPECS.length} SVG compositions + og-default.png → src/assets/img/`);
