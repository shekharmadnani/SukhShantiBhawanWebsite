#!/usr/bin/env node
/**
 * Creates placeholder media for trying the promo maker: a portrait poster,
 * a landscape venue video, a speaker photo, a landscape highlights video with
 * "speech" (pulsed tones, so you can hear the music duck), a registration
 * card, background music and a logo with a transparent background.
 *
 *   node promo/make-samples.js [workspace]     (default: promo/workspace)
 *
 * Then copies templates/bk-event.json to the workspace as promo.json, if
 * there isn't one already. Nothing here is real event material — replace it.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ws = path.resolve(process.argv[2] || path.join(__dirname, 'workspace'));
const media = path.join(ws, 'media');
fs.mkdirSync(media, { recursive: true });

const FONT = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  'C:/Windows/Fonts/arialbd.ttf'].find((f) => fs.existsSync(f));
if (!FONT) { console.error('No bold sans font found for the sample text.'); process.exit(1); }
const font = FONT.replace(/\\/g, '/').replace(/:/g, '\\:');

const text = (t, size, y, c = 'white') =>
  `drawtext=fontfile='${font}':text='${t}':fontsize=${size}:fontcolor=${c}:x=(w-text_w)/2:y=${y}`;

function ff(name, args) {
  process.stdout.write(`  ${name} … `);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, path.join(media, name)]);
  console.log('ok');
}

console.log(`Writing sample media to ${path.relative(process.cwd(), media) || media}`);

// Portrait poster with text right up to the edges — a crop would cut it.
ff('poster.png', ['-f', 'lavfi', '-i', 'gradients=s=1240x1754:c0=0x0d1b2a:c1=0x1b4965:x0=0:y0=0:x1=1240:y1=1754:nb_colors=2',
  '-vf', [text('BRAHMA KUMARIS', 64, 140, '0xf2c14e'), text('Inner Peace', 150, 520), text('Retreat', 150, 690),
    text('An evening of Rajyoga meditation', 54, 980), text('SUNDAY 7 DECEMBER  6 PM', 62, 1380, '0xf2c14e'),
    text('Sukh Shanti Bhawan, Sector 115, Noida', 48, 1500), text('Entry free  All welcome', 48, 1590)].join(','),
  '-frames:v', '1']);

// Landscape venue video, slow-moving, 20 s.
ff('venue.mp4', ['-f', 'lavfi', '-i', 'gradients=s=1920x1080:c0=0x3a506b:c1=0xe0b973:c2=0x1c2541:speed=0.015:d=20:r=30',
  '-vf', `${text('SAMPLE VENUE FOOTAGE', 84, 420)},${text('time %{pts\\:hms}', 56, 560, '0xffffffcc')},` +
  "drawbox=x='mod(t*120,1920)':y=820:w=160:h=160:color=0xf2c14e@0.8:t=fill",
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast']);

// Speaker photo (portrait 4:5).
ff('speaker.jpg', ['-f', 'lavfi', '-i', 'gradients=s=1200x1500:c0=0x5c4d7d:c1=0xd8c3a5:x0=0:y0=0:x1=0:y1=1500:nb_colors=2',
  '-vf', "geq=r='if(lt(hypot(X-600,Y-560),230)+lt(hypot((X-600)/1.6,Y-1250),330),40,r(X,Y))':" +
  "g='if(lt(hypot(X-600,Y-560),230)+lt(hypot((X-600)/1.6,Y-1250),330),45,g(X,Y))':" +
  "b='if(lt(hypot(X-600,Y-560),230)+lt(hypot((X-600)/1.6,Y-1250),330),60,b(X,Y))'," + text('SAMPLE SPEAKER PHOTO', 56, 80),
  '-frames:v', '1', '-q:v', '3']);

// Landscape highlights with on-camera "speech": pulsed tones on the audio.
ff('highlights.mp4', ['-f', 'lavfi', '-i', 'gradients=s=1920x1080:c0=0x2d6a4f:c1=0x95d5b2:c2=0x081c15:speed=0.03:d=40:r=30',
  '-f', 'lavfi', '-i', "aevalsrc='0.3*sin(2*PI*220*t)*lt(mod(t,0.9),0.5)*(0.6+0.4*sin(2*PI*3*t))':s=48000:d=40",
  '-vf', `${text('SAMPLE HIGHLIGHTS', 84, 380)},${text('the speaker is talking', 56, 520, '0xffffffcc')},` +
  `${text('time %{pts\\:hms}', 56, 620, '0xffffffcc')},drawbox=x=1300:y=300:w=380:h=480:color=0x081c15@0.6:t=fill`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-c:a', 'aac', '-shortest']);

// Registration card, 4:5.
ff('registration.png', ['-f', 'lavfi', '-i', 'color=c=0xf7f1e3:s=1080x1350',
  '-vf', [text('Register free', 96, 380, '0x0d1b2a'), text('Scan the QR code or', 50, 560, '0x0d1b2a'),
    text('message us on WhatsApp', 50, 630, '0x0d1b2a'),
    'drawbox=x=390:y=760:w=300:h=300:color=0x0d1b2a:t=12', text('QR', 90, 860, '0x0d1b2a')].join(','),
  '-frames:v', '1']);

// Calm background music: a slow, soft chord progression, 45 s.
ff('music.m4a', ['-f', 'lavfi', '-i',
  "aevalsrc='0.10*(sin(2*PI*(220+(mod(floor(t/4),2))*26.7)*t)+sin(2*PI*277.2*t)+sin(2*PI*329.6*t)+0.5*sin(2*PI*110*t))" +
  "*(0.75+0.25*sin(2*PI*t/4))':s=48000:d=45", '-c:a', 'aac', '-b:a', '160k']);

// Round logo on a transparent background.
ff('logo.png', ['-f', 'lavfi', '-i', 'color=c=0xf2c14e:s=400x400,format=rgba',
  '-vf', "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*lt(hypot(X-200,Y-200),196)'," +
  `drawtext=fontfile='${font}':text='BK':fontsize=170:fontcolor=0x0d1b2a:x=(w-text_w)/2:y=(h-text_h)/2`,
  '-frames:v', '1']);

const promoFile = path.join(ws, 'promo.json');
if (!fs.existsSync(promoFile)) {
  fs.copyFileSync(path.join(__dirname, 'templates', 'bk-event.json'), promoFile);
  console.log(`Created ${path.relative(process.cwd(), promoFile)} from templates/bk-event.json`);
}
console.log('Done.');
