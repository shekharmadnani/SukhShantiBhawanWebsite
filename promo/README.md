# Promo Maker

Turns an ordered set of images and video clips into one portrait **9:16 MP4**
(1080 × 1920) for WhatsApp Status, Instagram Reels and YouTube Shorts: an event
poster, a few seconds of venue footage, the speaker's photo with their name, a
highlights clip with the speaker's voice, and a registration card to finish.

It is a small local app on top of **FFmpeg**. No AI, no cloud, no dependencies
beyond Node and FFmpeg. Every promo is a JSON file, so last month's promo
becomes this month's template: swap in the new media and render.

```
poster.png ──┐  fit + blurred background, gentle zoom, 4 s
venue.mp4 ───┤  seconds 3–9, crop to fill
speaker.jpg ─┤  crop to fill, zoom, name + title caption          ──►  promo.mp4
highlights ──┤  seconds 10–18, manual framing, keeps speech          1080×1920, H.264/AAC
register.png ┘  fit + blur, closing caption, 5 s
             + logo in the corner, background music that dips under speech, cross-fades
```

## Quick start

You need **Node 18+** and **FFmpeg** (with `ffprobe`) on your PATH:

- Windows: `winget install Gyan.FFmpeg`
- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt install ffmpeg`

```bash
npm run promo:samples     # optional: placeholder media + the BK event template
```

```bash
npm run promo             # opens the editor at http://localhost:8090
```

Or render straight from the command line, with no editor:

```bash
node promo/render.js promo/workspace/promo.json            # full quality
```

```bash
node promo/render.js promo/workspace/promo.json --preview  # half size, ~3× faster
```

## Using the editor

| Panel | What it does |
|---|---|
| **Add a step** | Buttons for each part of an event promo: **Event poster**, **Venue video**, **Speaker photo**, **Highlights video**, **Registration image**, or any other image or video. Each one adds a step with suitable settings and opens the file dialog so you can choose its file. Every step also has a **Choose file… / Change file…** button. |
| **Media** | Import or drag in all your files, then set each one's type with its **Use this file as…** dropdown. Images: Event poster, Speaker photo, Registration image, Other image, Logo. Videos: Venue video, Highlights video, Other video. Audio (MP3, M4A, WAV, WMA, AAC, OGG, Opus, FLAC, AIFF, or an audio-only MP4/WebM): Background music. A file set to a step type fills that step (or adds it); badges show where each file is used. You can also drag a file into the sequence. |
| **Sequence** | The promo in order, with a **Background music** card at the bottom: click it to choose a track, or drag an audio file onto it, then set the volume, listen, change or remove it. Drag cards (or use ↑ ↓) to reorder. Problems, such as a missing file or an end point past the end of a video, are listed above it before you render. |
| **Clip** | The selected clip: its **step type** (changing it applies that type's usual settings), a 9:16 framing preview that matches the render, framing mode, duration or start/end (scrub the video and press **Start here** / **End here**), keep speech, zoom, transition and caption. In **Manual position**, drag the picture to choose what stays in frame. |
| **Promo settings** | **Music** and **Logo**, each with its own **Upload…** button, plus output size, transitions, fades, music (volume, ducking under speech), logo (corner, size, opacity), caption colours and font. |
| **Preview / Export** | Preview renders at half size (about 8 s for a 25 s promo); Export renders the final MP4 into `workspace/out/`. |
| **Templates…** | Save the current promo as a reusable template, or start from one. |

Everything is saved automatically in the **workspace** folder (default `promo/workspace/`,
which git ignores):

```
workspace/
  media/       imported files
  promo.json   the promo being edited
  templates/   your saved templates
  out/         previews and exports
```

To keep a separate workspace per event, run `node promo/server.js path/to/event-folder`.

## Framing modes

Most event material is not portrait. Each clip picks how to fit the 9:16 frame:

| Mode | Use it for | What happens |
|---|---|---|
| `fill` | Portrait photos, footage where the centre matters | Scaled to cover the frame, centre-cropped. Nothing letterboxed, but the sides of landscape material are lost. |
| `fit-blur` | **Posters**, landscape video, anything with text near the edges | The whole picture is shown, over a blurred, darkened copy of itself. Nothing is cropped. |
| `fit` | Same, with a plain colour behind | The whole picture on the `background` colour. |
| `manual` | Landscape footage of a speaker who isn't centred | Crop-to-fill, with a focus point (`focusX`, `focusY`, 0–1) and extra `scale`. Drag the picture in the editor to set it. |

In the fit modes a zoom would push the poster's edges out of frame, so the
renderer automatically leaves a margin as large as the zoom.

## The promo file

The editor writes this for you, but it's plain JSON and easy to edit or generate.
Relative paths are resolved from `mediaDir`, which is resolved from the JSON file's folder.

```jsonc
{
  "name": "Brahma Kumaris event promo",
  "mediaDir": "media",
  "output": { "width": 1080, "height": 1920, "fps": 30, "file": "out/promo.mp4", "crf": 20 },
  "background": "#0d1b2a",                          // behind "fit"
  "transition": { "type": "fade", "duration": 0.5 },
  "fadeIn": 0.4, "fadeOut": 0.8,                    // from / to black
  "font": { "file": null, "color": "#ffffff", "boxColor": "#0d1b2a", "boxOpacity": 0.55 },
  "logo":  { "file": "logo.png", "position": "top-right", "width": 0.15, "margin": 0.045, "opacity": 0.92 },
  "music": { "file": "music.m4a", "volume": 0.35, "start": 0, "duck": true, "duckAmount": 0.25,
             "fadeIn": 1, "fadeOut": 2 },
  "clips": [
    { "label": "Event poster", "file": "poster.png", "duration": 4,
      "framing": "fit-blur", "zoom": "in", "zoomAmount": 0.06 },
    { "label": "Venue", "file": "venue.mp4", "start": 3, "end": 9, "framing": "fill" },
    { "label": "Speaker", "file": "speaker.jpg", "duration": 4, "framing": "fill", "zoom": "in",
      "caption": { "title": "Speaker name", "subtitle": "Rajyoga teacher", "position": "bottom" } },
    { "label": "Highlights", "file": "highlights.mp4", "start": 10, "end": 18,
      "framing": "manual", "focusX": 0.78, "focusY": 0.5, "scale": 1,
      "keepAudio": true, "audioVolume": 1, "transition": "fadeblack" },
    { "label": "Registration", "file": "registration.png", "duration": 5, "framing": "fit-blur",
      "caption": { "title": "Om Shanti — see you there", "position": "top" } }
  ]
}
```

| Clip field | Applies to | Default | Meaning |
|---|---|---|---|
| `file` | all | — | Image or video, relative to `mediaDir` |
| `duration` | image | 4 | Seconds on screen |
| `start`, `end` | video | 0, start + 6 | Segment of the source, in seconds |
| `framing` | all | image `fit-blur`, video `fill` | See above |
| `focusX`, `focusY`, `scale` | `manual` | 0.5, 0.5, 1 | What stays in frame |
| `inset` | fit modes | 0 | Extra margin, as a fraction of the frame |
| `zoom`, `zoomAmount` | all | `none`, 0.08 | `in` or `out`; 0.06 = 6 % over the clip |
| `keepAudio`, `audioVolume` | video | false, 1 | Keep the clip's own sound, e.g. speech |
| `transition` | all but first | promo default | Transition *into* this clip |
| `caption.title`, `.subtitle`, `.position` | all | — | `bottom`, `center` or `top` |

Transitions available: `fade`, `fadeblack`, `fadewhite`, `dissolve`, `slideleft`,
`slideup`, `smoothleft`, `smoothup`, `circleopen`, `wipeleft`, `none` (hard cuts).

**Timing.** Transitions overlap neighbouring clips, so the promo is
*sum of clip durations − (clips − 1) × transition length*. The five-clip example is
4 + 6 + 4 + 8 + 5 = 27 s of material with four 0.5 s cross-fades, so **25 s** long.

**Audio.** Video clips are silent unless `keepAudio` is on. Music loops if it's shorter
than the promo, fades in and out, and with `duck` on it drops to about `duckAmount` of its
level while any kept clip audio is playing, then comes back up. A limiter stops the
mix from clipping.

## Hindi and other scripts

Captions are drawn with **libass**, which shapes Devanagari correctly: conjuncts and
vowel signs come out right. When a caption contains Hindi, a Devanagari font is chosen
automatically if one is installed (Noto Sans Devanagari, Nirmala UI on Windows,
Kohinoor on macOS, Lohit or FreeSans on Linux). For the best result install
[Noto Sans Devanagari](https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari) and
point `font.file` at its Bold weight. One font is used for the whole caption, and
characters it lacks fall back to another installed font.

## How it works

`render.js` is the whole engine (~600 lines), and it renders in two FFmpeg passes:

1. **Each clip becomes a normalised segment** of exactly the right size, frame rate and
   length, with stereo 48 kHz audio (silence if the clip's sound is off). Framing, zoom
   and captions happen here. Images go through `zoompan` at 2× size, which keeps slow
   zooms from stepping. Videos are trimmed with `-ss/-t`, and if a source runs short its
   last frame is held.
2. **The segments are joined** with `xfade` and `acrossfade`, faded from and to black, and
   given the logo overlay, music (`sidechaincompress` for ducking) and a limiter. The
   output is H.264 High / AAC with `+faststart`, which plays on any phone.

Keeping the passes separate means a bad clip fails with an error that names it, and
it's the obvious place to cache segments later. `prepare()` validates the whole promo
with `ffprobe` before anything renders, and the editor shows its findings as you work.

`server.js` is a dependency-free local server (bound to 127.0.0.1) for the editor:
media upload, range requests so videos can be scrubbed, autosave, and render jobs with
progress. `ui/index.html` is the editor itself, one file of plain HTML/CSS/JS.

## Next steps

Things this version deliberately does not do yet:

- **Real-time preview.** Preview is a fast half-size render, not live playback. A
  browser-side player (canvas or WebCodecs) could play the sequence directly.
- **Segment cache.** Unchanged clips are re-rendered each time. Hashing each clip's settings
  would make re-exports after a small change near-instant.
- **AI assists**, all slotting in as producers of fields that already exist:
  - *highlight selection*, which suggests `start`/`end` for long recordings (scene changes and
    audio energy, or a vision model);
  - *subtitles*, through Whisper → a caption track, rendered by libass just like captions;
  - *auto-reframe*, through face/person tracking → a per-frame `focusX` path for `manual`
    framing, instead of a fixed point.
- **A native build.** The UI and FFmpeg graph would carry over to a C++/Qt app that
  links libav* directly, if a single installable program is ever wanted.
