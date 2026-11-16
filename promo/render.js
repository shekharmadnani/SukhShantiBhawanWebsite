#!/usr/bin/env node
/**
 * ============================================================================
 *  PROMO RENDERER — turns a promo description (JSON) into one 9:16 MP4.
 * ============================================================================
 *
 *  A promo is an ordered list of clips. Each clip is an image (shown for N
 *  seconds) or a segment of a video (start → end). Every clip is framed into
 *  the portrait canvas, optionally zoomed and captioned, and the clips are then
 *  joined with transitions; a logo, background music and fades go on top.
 *
 *  Usage:
 *    node promo/render.js path/to/promo.json            full-quality export
 *    node promo/render.js path/to/promo.json --preview  fast half-size draft
 *    node promo/render.js promo.json --out final.mp4    choose the output file
 *
 *  Rendering happens in two passes, both plain FFmpeg:
 *    1. each clip → a normalised segment (same size, frame rate, audio format)
 *    2. segments → crossfades + logo + music → the final MP4
 *  Keeping the passes separate means one bad clip produces a clear error that
 *  names the clip, rather than one unreadable 200-line filter graph.
 *
 *  The template format is documented in promo/README.md.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || 'ffprobe';

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tif', '.tiff'];
const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.avi', '.mts', '.3gp'];
const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac', '.opus'];

const FRAMINGS = ['fill', 'fit-blur', 'fit', 'manual'];
const TRANSITIONS = ['fade', 'fadeblack', 'fadewhite', 'dissolve', 'slideleft', 'slideup',
  'smoothleft', 'smoothup', 'circleopen', 'wipeleft', 'none'];
const CAPTION_POSITIONS = ['bottom', 'center', 'top'];

/* --------------------------------------------------------------- fonts --- */

// First existing file wins. Template `font.file` overrides all of this.
const LATIN_FONTS = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/Library/Fonts/Arial Bold.ttf',
  'C:\\Windows\\Fonts\\arialbd.ttf',
  'C:\\Windows\\Fonts\\segoeuib.ttf',
];
// Used automatically when a caption contains Devanagari (Hindi) text.
const DEVANAGARI_FONTS = [
  '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf',
  '/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf',
  '/usr/share/fonts/opentype/noto/NotoSansDevanagari-Bold.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
  '/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf',
  '/System/Library/Fonts/Kohinoor.ttc',
  '/Library/Fonts/Devanagari Sangam MN.ttc',
  'C:\\Windows\\Fonts\\NirmalaB.ttf',
  'C:\\Windows\\Fonts\\Nirmala.ttf',
  'C:\\Windows\\Fonts\\mangal.ttf',
];
const hasDevanagari = (s) => /[\u0900-\u097F]/.test(s || '');
const firstExisting = (list) => list.find((f) => { try { return fs.statSync(f).isFile(); } catch { return false; } });

/* ------------------------------------------------------------- helpers --- */

const kindOf = (file) => {
  const ext = path.extname(file || '').toLowerCase();
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  return null;
};
const even = (n) => Math.max(2, Math.round(n / 2) * 2);
const num = (n) => Number(n).toFixed(3).replace(/\.?0+$/, '') || '0';
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const color = (c, fallback) => {
  const v = String(c || fallback).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? '0x' + v.slice(1) : v.replace(/[^a-zA-Z0-9@.]/g, '');
};

/** Media facts from ffprobe: kind, width, height, duration, hasAudio. */
function probe(file) {
  const raw = execFileSync(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file],
    { maxBuffer: 16 * 1024 * 1024 }).toString();
  const info = JSON.parse(raw);
  const streams = info.streams || [];
  const v = streams.find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  const a = streams.find((s) => s.codec_type === 'audio');
  let width = v ? v.width : 0;
  let height = v ? v.height : 0;
  // Phone videos are often stored landscape with a rotation flag; FFmpeg
  // rotates them on decode, so report the size as it will actually appear.
  const rot = v && (Number((v.tags || {}).rotate) ||
    Number(((v.side_data_list || []).find((d) => d.rotation !== undefined) || {}).rotation) || 0);
  if (Math.abs(rot) % 180 === 90) [width, height] = [height, width];
  const duration = Number((info.format || {}).duration) || Number(v && v.duration) || 0;
  return { kind: kindOf(file), width, height, duration, hasAudio: !!a };
}

/* ------------------------------------------------------------ template --- */

const DEFAULTS = {
  output: { width: 1080, height: 1920, fps: 30, file: 'promo.mp4', crf: 20, preset: 'medium' },
  background: '#0d1b2a',
  transition: { type: 'fade', duration: 0.5 },
  fadeIn: 0.4,
  fadeOut: 0.8,
  font: { file: null, color: '#ffffff', boxColor: '#000000', boxOpacity: 0.45 },
  logo: null,
  music: null,
};

/**
 * Fill in defaults and check every clip. Returns { promo, problems } where
 * problems is a list of human-readable strings naming the clip at fault.
 */
function prepare(template, baseDir) {
  const problems = [];
  const t = JSON.parse(JSON.stringify(template || {}));
  const mediaDir = path.resolve(baseDir, t.mediaDir || '.');
  const resolve = (f) => (f ? path.resolve(mediaDir, f) : null);

  const output = { ...DEFAULTS.output, ...(t.output || {}) };
  output.width = even(output.width);
  output.height = even(output.height);
  output.fps = clamp(Number(output.fps) || 30, 12, 60);

  const transition = { ...DEFAULTS.transition, ...(t.transition || {}) };
  if (!TRANSITIONS.includes(transition.type)) {
    problems.push(`Transition "${transition.type}" is not one of: ${TRANSITIONS.join(', ')}`);
    transition.type = 'fade';
  }
  transition.duration = transition.type === 'none' ? 0 : clamp(Number(transition.duration) || 0, 0, 2);

  const font = { ...DEFAULTS.font, ...(t.font || {}) };
  if (font.file) {
    font.file = path.resolve(baseDir, font.file);
    if (!fs.existsSync(font.file)) problems.push(`Font file not found: ${font.file}`);
  }

  const clips = (t.clips || []).map((c, i) => {
    const label = `Clip ${i + 1}${c.label ? ` (${c.label})` : ''}`;
    const clip = { ...c, label, file: resolve(c.file) };
    if (!c.file) { problems.push(`${label}: no media file chosen`); return clip; }
    if (!fs.existsSync(clip.file)) { problems.push(`${label}: file not found — ${c.file}`); return clip; }
    clip.type = kindOf(clip.file);
    if (clip.type !== 'image' && clip.type !== 'video') {
      problems.push(`${label}: ${c.file} is not an image or video`); return clip;
    }
    try { clip.info = probe(clip.file); } catch (e) {
      problems.push(`${label}: FFmpeg could not read ${c.file}`); return clip;
    }
    if (!clip.info.width) { problems.push(`${label}: ${c.file} has no picture`); return clip; }

    if (clip.type === 'image') {
      clip.duration = Number(c.duration) || 4;
    } else {
      const len = clip.info.duration;
      clip.start = Math.max(0, Number(c.start) || 0);
      clip.end = c.end === undefined || c.end === null || c.end === '' ? Math.min(len, clip.start + 6) : Number(c.end);
      if (len && clip.end > len + 0.05) {
        problems.push(`${label}: end ${num(clip.end)}s is past the end of the video (${num(len)}s)`);
      }
      if (len && clip.start >= len) problems.push(`${label}: start ${num(clip.start)}s is past the end of the video`);
      clip.duration = clip.end - clip.start;
      clip.keepAudio = !!c.keepAudio && clip.info.hasAudio;
      clip.audioVolume = c.audioVolume === undefined ? 1 : clamp(Number(c.audioVolume), 0, 4);
    }
    if (!(clip.duration > 0)) problems.push(`${label}: duration must be more than 0 seconds`);
    if (clip.duration > 0 && clip.duration < transition.duration * 2 + 0.2) {
      problems.push(`${label}: ${num(clip.duration)}s is too short for ${num(transition.duration)}s transitions`);
    }

    clip.framing = c.framing || (clip.type === 'image' ? 'fit-blur' : 'fill');
    if (!FRAMINGS.includes(clip.framing)) {
      problems.push(`${label}: framing "${clip.framing}" is not one of: ${FRAMINGS.join(', ')}`);
      clip.framing = 'fill';
    }
    clip.focusX = clamp(c.focusX === undefined ? 0.5 : Number(c.focusX), 0, 1);
    clip.focusY = clamp(c.focusY === undefined ? 0.5 : Number(c.focusY), 0, 1);
    clip.scale = clamp(Number(c.scale) || 1, 1, 4);
    clip.inset = clamp(Number(c.inset) || 0, 0, 0.3);
    clip.zoom = ['in', 'out'].includes(c.zoom) ? c.zoom : 'none';
    clip.zoomAmount = clamp(c.zoomAmount === undefined ? 0.08 : Number(c.zoomAmount), 0, 0.5);

    if (c.caption && (c.caption.title || c.caption.subtitle)) {
      clip.caption = {
        title: String(c.caption.title || ''),
        subtitle: String(c.caption.subtitle || ''),
        position: CAPTION_POSITIONS.includes(c.caption.position) ? c.caption.position : 'bottom',
      };
    } else clip.caption = null;
    return clip;
  });
  if (!clips.length) problems.push('The promo has no clips.');

  let logo = null;
  if (t.logo && t.logo.file) {
    logo = {
      position: 'top-right', width: 0.16, margin: 0.04, opacity: 0.9,
      ...t.logo, file: resolve(t.logo.file),
    };
    if (!fs.existsSync(logo.file)) { problems.push(`Logo file not found: ${t.logo.file}`); logo = null; }
  }

  let music = null;
  if (t.music && t.music.file) {
    music = { volume: 0.35, start: 0, duck: true, duckAmount: 0.25, fadeIn: 1, fadeOut: 2, ...t.music, file: resolve(t.music.file) };
    if (!fs.existsSync(music.file)) { problems.push(`Music file not found: ${t.music.file}`); music = null; }
  }

  const promo = {
    output, transition, font, clips, logo, music,
    background: t.background || DEFAULTS.background,
    fadeIn: Math.max(0, t.fadeIn === undefined ? DEFAULTS.fadeIn : Number(t.fadeIn)),
    fadeOut: Math.max(0, t.fadeOut === undefined ? DEFAULTS.fadeOut : Number(t.fadeOut)),
  };
  promo.total = clips.reduce((s, c) => s + (c.duration || 0), 0) -
    Math.max(0, clips.length - 1) * transition.duration;
  return { promo, problems };
}

/* ------------------------------------------------------ filter building --- */

/** Framing: any source → exactly W×H. Returns a filter-graph fragment. */
function framingFilter(clip, W, H, bg, inp, out) {
  const lanczos = 'flags=lanczos';
  if (clip.framing === 'fill' || clip.framing === 'manual') {
    // Crop-to-fill. "manual" adds a focus point and extra zoom, so a speaker
    // standing off-centre in landscape footage can be kept in frame.
    const s = clip.framing === 'manual' ? clip.scale : 1;
    const fx = clip.framing === 'manual' ? clip.focusX : 0.5;
    const fy = clip.framing === 'manual' ? clip.focusY : 0.5;
    return `[${inp}]scale=w=${even(W * s)}:h=${even(H * s)}:force_original_aspect_ratio=increase:${lanczos},` +
      `crop=${W}:${H}:(iw-${W})*${num(fx)}:(ih-${H})*${num(fy)},setsar=1[${out}]`;
  }
  // Fit modes keep the whole picture visible — the poster's text never gets
  // cropped. A zoom would push the edges out of frame, so leave room for it.
  const zoomRoom = clip.zoom !== 'none' ? clip.zoomAmount / 2 + 0.01 : 0;
  const inset = Math.max(clip.inset, zoomRoom);
  const bw = even(W * (1 - 2 * inset));
  const bh = even(H * (1 - 2 * inset));
  const fg = `scale=w=${bw}:h=${bh}:force_original_aspect_ratio=decrease:force_divisible_by=2:${lanczos}`;
  if (clip.framing === 'fit') {
    return `[${inp}]${fg},format=yuva420p,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${color(bg)},setsar=1[${out}]`;
  }
  // fit-blur: the same picture, cropped to fill, shrunk, blurred and darkened,
  // sits behind the fitted one. Blurring at 1/6 size is fast and very soft.
  const sw = even(W / 6), sh = even(H / 6);
  return `[${inp}]split[${out}a][${out}b];` +
    `[${out}a]scale=w=${sw}:h=${sh}:force_original_aspect_ratio=increase,crop=${sw}:${sh},` +
    `boxblur=8:2,eq=brightness=-0.14:saturation=1.15,scale=${W}:${H}:flags=bicubic,setsar=1[${out}bg];` +
    `[${out}b]${fg},setsar=1[${out}fg];` +
    `[${out}bg][${out}fg]overlay=(W-w)/2:(H-h)/2:format=auto[${out}]`;
}

/**
 * A font file's family name and whether it is bold, read from its 'name'
 * table. libass picks fonts by family name, not by file.
 */
function fontFamily(file) {
  const b = fs.readFileSync(file);
  let off = 0;
  if (b.toString('latin1', 0, 4) === 'ttcf') off = b.readUInt32BE(12); // first face of a collection
  const numTables = b.readUInt16BE(off + 4);
  for (let i = 0; i < numTables; i++) {
    const rec = off + 12 + i * 16;
    if (b.toString('latin1', rec, rec + 4) !== 'name') continue;
    const tbl = b.readUInt32BE(rec + 8);
    const count = b.readUInt16BE(tbl + 2), strings = tbl + b.readUInt16BE(tbl + 4);
    const names = {};
    for (let j = 0; j < count; j++) {
      const r = tbl + 6 + j * 12;
      const platform = b.readUInt16BE(r), id = b.readUInt16BE(r + 6);
      const len = b.readUInt16BE(r + 8), at = strings + b.readUInt16BE(r + 10);
      if (names[id] && platform !== 3) continue; // prefer Windows (UTF-16BE) names
      const raw = b.subarray(at, at + len);
      names[id] = platform === 3 || platform === 0
        ? Buffer.from(raw).swap16().toString('utf16le') : raw.toString('latin1');
    }
    const family = names[16] || names[1];
    const style = names[17] || names[2] || '';
    if (family) return { family, bold: /bold|black|heavy|semibold/i.test(style) };
  }
  return { family: path.basename(file, path.extname(file)), bold: false };
}

/** #rrggbb + opacity → ASS colour &HAABBGGRR (ASS alpha: 00 opaque, FF clear). */
function assColor(hex, opacity = 1) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || '').trim()) || [0, 'ff', 'ff', 'ff'];
  const a = Math.round((1 - clamp(opacity, 0, 1)) * 255).toString(16).padStart(2, '0');
  return `&H${a}${m[3]}${m[2]}${m[1]}`.toUpperCase();
}
const assTime = (t) => {
  const cs = Math.round(Math.max(0, t) * 100);
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:` +
    `${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
const assText = (s) => String(s).replace(/[{}]/g, '').replace(/\\/g, '/').replace(/\r?\n/g, '\\N');

/**
 * Captions are drawn by libass (FFmpeg's `ass` filter) rather than drawtext:
 * libass shapes complex scripts properly — Hindi conjuncts and vowel signs
 * come out right — wraps long lines, and falls back to another installed
 * font for any character the chosen font lacks. Returns a filter, or ''.
 */
function captionFilter(clip, idx, promo, W, H, work) {
  const cap = clip.caption;
  if (!cap) return '';
  const all = cap.title + cap.subtitle;
  const fontFile = promo.font.file || (hasDevanagari(all) && firstExisting(DEVANAGARI_FONTS)) || firstExisting(LATIN_FONTS);
  let family = 'Sans', bold = true;
  if (fontFile) {
    fs.copyFileSync(fontFile, path.join(work, `font${idx}${path.extname(fontFile)}`));
    ({ family, bold } = fontFamily(fontFile));
    if (!promo.font.file) bold = true;
  }
  const titleSize = Math.round(W * 0.064);
  const subSize = Math.round(W * 0.042);
  const pad = Math.round(W * 0.016);
  const align = { bottom: 2, center: 5, top: 8 }[cap.position];
  const marginV = cap.position === 'top' ? Math.round(H * 0.14) : cap.position === 'bottom' ? Math.round(H * 0.20) : 0;
  const marginH = Math.round(W * 0.07);
  const text = [cap.title && assText(cap.title), cap.subtitle && `{\\fs${subSize}}${assText(cap.subtitle)}`]
    .filter(Boolean).join('\\N');
  const ass = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 0',
    'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, ' +
      'Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // BorderStyle 4 (libass) = one box behind the whole caption, padded by
    // Outline. Its colour is BackColour. Older libass treats 4 as 3: a box per line.
    `Style: Cap,${family},${titleSize},${assColor(promo.font.color)},${assColor(promo.font.color)},` +
      // OutlineColour stays clear (no halo on the letters); BackColour is the box.
      `&HFF000000,${assColor(promo.font.boxColor || '#000000', promo.font.boxOpacity)},` +
      `${bold ? -1 : 0},0,0,0,100,100,0,0,` +
      `4,${pad},0,${align},${marginH},${marginH},${marginV},1`,
    '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    `Dialogue: 0,${assTime(0.25)},${assTime(clip.duration + 1)},Cap,,0,0,0,,{\\fad(450,0)}${text}`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(work, `cap${idx}.ass`), ass);
  return `ass=filename=cap${idx}.ass:fontsdir=.:shaping=complex`;
}

/* ------------------------------------------------------------- running --- */

/** Run FFmpeg, reporting progress (0–1) for a pass of known length. */
function ffmpeg(args, { cwd, seconds, onProgress, log }) {
  return new Promise((resolve, reject) => {
    const full = ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error', '-progress', 'pipe:1', ...args];
    if (log) log(`ffmpeg ${full.map((a) => (/[\s;[\]]/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
    const p = spawn(FFMPEG, full, { cwd });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.stdout.on('data', (d) => {
      const m = String(d).match(/out_time_us=(\d+)/g);
      if (m && onProgress && seconds) {
        const us = Number(m[m.length - 1].split('=')[1]);
        onProgress(clamp(us / 1e6 / seconds, 0, 1));
      }
    });
    p.on('error', (e) => reject(new Error(`Could not start FFmpeg (${e.message}). Is it installed and on PATH?`)));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim().split('\n').slice(-6).join('\n') || `FFmpeg exited with ${code}`))));
  });
}

/** Pass 1: one clip → a normalised segment file. */
async function renderSegment(clip, idx, promo, ctx) {
  const { W, H, fps, work, preview } = ctx;
  const D = clip.duration;
  const frames = Math.round(D * fps);
  const args = [];
  if (clip.type === 'image') args.push('-i', clip.file);
  else args.push('-ss', num(clip.start), '-t', num(D + 0.5), '-i', clip.file);
  args.push('-f', 'lavfi', '-t', num(D), '-i', 'anullsrc=r=48000:cl=stereo');

  const g = [];
  g.push(framingFilter(clip, W, H, promo.background, '0:v', 'fr'));
  let last = 'fr';
  if (clip.type === 'image') {
    // One still frame → D seconds of video. zoompan generates the frames;
    // working at twice the size keeps a slow zoom from stepping visibly.
    const A = clip.zoom === 'none' ? 0 : clip.zoomAmount;
    const p = `on/${Math.max(1, frames - 1)}`;
    const z = clip.zoom === 'out' ? `${num(1 + A)}-${num(A)}*${p}` : `1+${num(A)}*${p}`;
    const pre = A ? `scale=${W * 2}:${H * 2}:flags=lanczos,` : '';
    g.push(`[${last}]${pre}zoompan=z='${z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frames}:s=${W}x${H}:fps=${fps}[zm]`);
    last = 'zm';
  } else {
    // Video: hold the last frame if the source runs out early. A gentle zoom
    // uses zoompan as for images, one output frame per input frame (d=1).
    let chain = `fps=${fps},tpad=stop_mode=clone:stop_duration=${num(D)},trim=duration=${num(D)},setpts=PTS-STARTPTS`;
    if (clip.zoom !== 'none' && clip.zoomAmount) {
      const A = clip.zoomAmount;
      const p = `on/${Math.max(1, frames - 1)}`;
      const z = clip.zoom === 'out' ? `${num(1 + A)}-${num(A)}*${p}` : `1+${num(A)}*${p}`;
      chain += `,scale=${W * 2}:${H * 2}:flags=bicubic,zoompan=z='${z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${W}x${H}:fps=${fps}`;
    }
    g.push(`[${last}]${chain}[zm]`);
    last = 'zm';
  }
  const cap = captionFilter(clip, idx, promo, W, H, work);
  g.push(`[${last}]${cap ? cap + ',' : ''}format=yuv420p,setsar=1[v]`);

  if (clip.keepAudio) {
    g.push(`[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${num(clip.audioVolume)},` +
      `apad,atrim=0:${num(D)},asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st=${num(Math.max(0, D - 0.05))}:d=0.05[a]`);
  } else {
    g.push(`[1:a]aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${num(D)}[a]`);
  }

  const out = `seg${idx}.mkv`;
  await ffmpeg([...args, '-filter_complex', g.join(';'), '-map', '[v]', '-map', '[a]',
    '-t', num(D), '-r', String(fps),
    '-c:v', 'libx264', '-preset', preview ? 'ultrafast' : 'veryfast', '-crf', preview ? '24' : '14', '-pix_fmt', 'yuv420p',
    '-c:a', 'pcm_s16le', out], { cwd: work, seconds: D, onProgress: ctx.progress, log: ctx.log });
  return out;
}

/** Pass 2: segments → transitions, fades, logo, music → final MP4. */
async function renderFinal(segs, promo, outFile, ctx) {
  const { W, H, fps, work, preview } = ctx;
  const T = promo.transition.duration;
  const n = segs.length;
  const total = promo.total;
  const args = [];
  segs.forEach((s) => args.push('-i', s));
  let idx = n;
  const logoIn = promo.logo ? idx++ : -1;
  if (promo.logo) args.push('-i', promo.logo.file);
  const musicIn = promo.music ? idx++ : -1;
  if (promo.music) args.push('-stream_loop', '-1', '-ss', num(promo.music.start || 0), '-i', promo.music.file);

  const g = [];
  for (let i = 0; i < n; i++) g.push(`[${i}:v]settb=AVTB,setpts=PTS-STARTPTS[v${i}];[${i}:a]asetpts=PTS-STARTPTS[a${i}]`);

  // Joins. xfade/acrossfade overlap neighbouring clips by T seconds, so the
  // promo is (sum of clip durations) − (clips − 1) × T long.
  let v = 'v0', a = 'a0';
  if (n > 1 && T > 0) {
    let offset = 0;
    for (let i = 1; i < n; i++) {
      offset += promo.clips[i - 1].duration - T;
      const type = promo.clips[i].transition && TRANSITIONS.includes(promo.clips[i].transition) && promo.clips[i].transition !== 'none'
        ? promo.clips[i].transition : promo.transition.type;
      g.push(`[${v}][v${i}]xfade=transition=${type}:duration=${num(T)}:offset=${num(offset)}[vx${i}]`);
      g.push(`[${a}][a${i}]acrossfade=d=${num(T)}:c1=tri:c2=tri[ax${i}]`);
      v = `vx${i}`; a = `ax${i}`;
    }
  } else if (n > 1) {
    g.push(`${segs.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${n}:v=1:a=1[vc][ac]`);
    v = 'vc'; a = 'ac';
  }

  // Fade from and to black.
  const vf = [];
  if (promo.fadeIn) vf.push(`fade=t=in:st=0:d=${num(promo.fadeIn)}`);
  if (promo.fadeOut) vf.push(`fade=t=out:st=${num(Math.max(0, total - promo.fadeOut))}:d=${num(promo.fadeOut)}`);
  g.push(`[${v}]${vf.length ? vf.join(',') : 'null'}[vf]`);
  v = 'vf';

  if (promo.logo) {
    const L = promo.logo;
    const lw = even(W * clamp(Number(L.width) || 0.16, 0.03, 0.8));
    const m = Math.round(W * clamp(Number(L.margin) || 0.04, 0, 0.3));
    const pos = {
      'top-left': [`${m}`, `${m}`], 'top-right': [`W-w-${m}`, `${m}`], 'top-center': ['(W-w)/2', `${m}`],
      'bottom-left': [`${m}`, `H-h-${m}`], 'bottom-right': [`W-w-${m}`, `H-h-${m}`], 'bottom-center': ['(W-w)/2', `H-h-${m}`],
    }[L.position] || [`W-w-${m}`, `${m}`];
    // Logo comes in with the picture and leaves with it.
    let lf = `[${logoIn}:v]scale=${lw}:-1:flags=lanczos,format=rgba,colorchannelmixer=aa=${num(clamp(Number(L.opacity) || 0.9, 0, 1))},loop=loop=-1:size=1,` +
      `fps=${fps},trim=duration=${num(total)},setpts=PTS-STARTPTS`;
    if (promo.fadeIn) lf += `,fade=t=in:st=0:d=${num(promo.fadeIn)}:alpha=1`;
    if (promo.fadeOut) lf += `,fade=t=out:st=${num(Math.max(0, total - promo.fadeOut))}:d=${num(promo.fadeOut)}:alpha=1`;
    g.push(`${lf}[logo]`);
    g.push(`[${v}][logo]overlay=x=${pos[0]}:y=${pos[1]}:format=auto[vl]`);
    v = 'vl';
  }
  g.push(`[${v}]format=yuv420p[vout]`);

  // Audio: clip sound (speech) + music. With ducking on, the music drops
  // whenever there is speech, then comes back up.
  if (promo.music) {
    const M = promo.music;
    const fo = Math.min(Number(M.fadeOut) || 0, total);
    g.push(`[${musicIn}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${num(total)},asetpts=PTS-STARTPTS,` +
      `volume=${num(clamp(Number(M.volume), 0, 2))}` +
      `${M.fadeIn ? `,afade=t=in:d=${num(M.fadeIn)}` : ''}${fo ? `,afade=t=out:st=${num(total - fo)}:d=${num(fo)}` : ''}[mus]`);
    const speech = promo.clips.some((c) => c.keepAudio);
    if (speech && M.duck) {
      // ratio from duckAmount: 0.25 → music falls to roughly a quarter under speech.
      const ratio = clamp(1 / clamp(Number(M.duckAmount) || 0.25, 0.05, 1), 1, 20);
      g.push(`[${a}]asplit[sp][sc];[mus][sc]sidechaincompress=threshold=0.015:ratio=${num(ratio)}:attack=30:release=500[duck];` +
        `[sp][duck]amix=inputs=2:duration=first:normalize=0[am]`);
    } else {
      g.push(`[${a}][mus]amix=inputs=2:duration=first:normalize=0[am]`);
    }
    a = 'am';
  }
  g.push(`[${a}]apad,atrim=0:${num(total)},alimiter=limit=0.95:level=false${promo.fadeOut ? `,afade=t=out:st=${num(Math.max(0, total - promo.fadeOut))}:d=${num(promo.fadeOut)}` : ''}[aout]`);

  await ffmpeg([...args, '-filter_complex', g.join(';'), '-map', '[vout]', '-map', '[aout]',
    '-t', num(total), '-r', String(fps),
    '-c:v', 'libx264', '-preset', preview ? 'ultrafast' : promo.output.preset, '-crf', String(preview ? 26 : promo.output.crf),
    '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', preview ? '128k' : '192k', '-ar', '48000',
    '-movflags', '+faststart', outFile], { cwd: work, seconds: total, onProgress: ctx.progress, log: ctx.log });
}

/**
 * Render a promo. `template` is the parsed JSON; relative paths in it are
 * resolved against `baseDir`. Returns { file, duration, problems }.
 * onProgress(fraction, stageText) is called as work proceeds.
 */
async function render(template, { baseDir = process.cwd(), preview = false, out, onProgress, log } = {}) {
  const { promo, problems } = prepare(template, baseDir);
  if (problems.length) {
    const e = new Error(`The promo cannot be rendered yet:\n  • ${problems.join('\n  • ')}`);
    e.problems = problems;
    throw e;
  }
  const scale = preview ? 0.5 : 1;
  const ctx = {
    W: even(promo.output.width * scale), H: even(promo.output.height * scale), fps: promo.output.fps,
    preview, log, work: fs.mkdtempSync(path.join(os.tmpdir(), 'promo-')),
  };
  const outFile = path.resolve(baseDir, out || (preview
    ? promo.output.file.replace(/(\.mp4)?$/i, '-preview.mp4') : promo.output.file));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  // Progress: pass 1 weighted by clip length, pass 2 counts as much again.
  const totalWork = promo.clips.reduce((s, c) => s + c.duration, 0) + promo.total;
  let done = 0;
  const report = (stage) => (f) => onProgress && onProgress(clamp((done + f * stage.len) / totalWork, 0, 1), stage.text);
  try {
    const segs = [];
    for (let i = 0; i < promo.clips.length; i++) {
      const c = promo.clips[i];
      ctx.progress = report({ len: c.duration, text: `Preparing ${c.label}` });
      ctx.progress(0);
      segs.push(await renderSegment(c, i, promo, ctx).catch((e) => { throw new Error(`${c.label}: ${e.message}`); }));
      done += c.duration;
    }
    ctx.progress = report({ len: promo.total, text: 'Joining clips, adding logo and music' });
    ctx.progress(0);
    await renderFinal(segs, promo, outFile, ctx);
    if (onProgress) onProgress(1, 'Done');
    return { file: outFile, duration: promo.total, width: ctx.W, height: ctx.H };
  } finally {
    if (!process.env.PROMO_KEEP_WORK) fs.rmSync(ctx.work, { recursive: true, force: true });
  }
}

module.exports = { render, prepare, probe, kindOf, FRAMINGS, TRANSITIONS };

/* ----------------------------------------------------------------- CLI --- */

if (require.main === module) {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out');
  if (!file) {
    console.log('Usage: node promo/render.js promo.json [--preview] [--out file.mp4] [--verbose]');
    process.exit(1);
  }
  const outIdx = argv.indexOf('--out');
  const tplPath = path.resolve(file);
  const template = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
  let lastLine = '';
  const t0 = Date.now();
  render(template, {
    baseDir: path.dirname(tplPath),
    preview: argv.includes('--preview'),
    out: outIdx >= 0 ? path.resolve(argv[outIdx + 1]) : undefined,
    log: argv.includes('--verbose') ? (s) => console.error(s) : null,
    onProgress: (f, stage) => {
      const line = `${String(Math.round(f * 100)).padStart(3)}%  ${stage}`;
      if (line !== lastLine && process.stdout.isTTY) process.stdout.write(`\r${line.padEnd(70)}`);
      else if (stage !== lastLine.slice(6)) console.log(line);
      lastLine = line;
    },
  }).then((r) => {
    console.log(`\n✓ ${path.relative(process.cwd(), r.file)} — ${r.width}×${r.height}, ${r.duration.toFixed(1)}s, ` +
      `rendered in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }).catch((e) => { console.error(`\n✗ ${e.message}`); process.exit(1); });
}
