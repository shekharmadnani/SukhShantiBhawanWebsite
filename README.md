# Sukh Shanti Bhawan — website

A proposed replacement for [sukhshantibhawannoida.org](https://sukhshantibhawannoida.org/):
a static site for the Brahma Kumaris centre at Sector 115, Noida, in the register of
[brahmakumaris.com](https://www.brahmakumaris.com/) and [brahmakumaris.us](https://brahmakumaris.us/).

Ten pages, no framework, no dependencies, no build service. `node build.js` turns `src/`
into a `dist/` folder of plain HTML that will run on GitHub Pages, Netlify, Cloudflare
Pages, or any shared host with an FTP login.

---

## ⚠ Read this first — details that must be verified

The centre's real contact details are not published anywhere this site could be built
from, so **some values are placeholders**. They are all in one file,
[`src/data/site.js`](src/data/site.js), each marked with the word `VERIFY`:

```
grep -n VERIFY src/data/site.js
```

| What | Current value | Needs |
|---|---|---|
| Phone | `+91 00000 00000` | The centre's number |
| Email | `info@sukhshantibhawannoida.org` | A real, monitored mailbox |
| WhatsApp | `910000000000` | Number, or delete the entry |
| Street address | Building/plot line missing | The full postal address |
| Google Maps link & embed | A search for the sector | The centre's own place link |
| Directions | Nearest metro stations, parking | Local landmarks people actually use |
| Class timings | The timings common to BK centres in India | **The centre's actual timings** |
| Social links | YouTube and Instagram are `#` | Real URLs, or delete the entries |
| Reflections | Written placeholders | Real words from students, with permission |
| Event dates | Month only | Exact dates, refreshed each year |
| `url` | `https://sukhshantibhawannoida.org` | The final domain |

Nothing on the site is invented beyond these — the material about Rajyoga, the
organisation's history and the course contents is standard Brahma Kumaris material.
But **do not publish until the table above is done**: a wrong phone number is worse
than the old site.

---

## Running it

```bash
node build.js       # build src/ → dist/
npm run serve       # build, then serve dist/ at http://localhost:8080
npm test            # build + check links + check for horizontal overflow
```

Node 18 or newer. There is nothing to `npm install`.

## How the site is put together

```
src/
  data/site.js        ← all content: contact, timings, courses, events, FAQs
  layouts/base.html   ← the page shell: <head>, header, footer, JSON-LD
  partials/           ← header, footer, icons, logo, CTA band, page hero
  pages/*.html        ← one file per page, with JSON front-matter in a comment
  assets/             ← css, js, images (copied to dist/ untouched)
build.js              ← the builder (~180 lines, no dependencies)
tools/
  make-art.js         ← regenerates the artwork in src/assets/img/
  check.js            ← dead links, missing assets, duplicate ids, alt text
  measure.js          ← renders every page at 320–1600px, fails on overflow
  serve.js            ← local preview server
```

### Editing content

Almost every change is a change to `src/data/site.js`. Add a course to the `courses`
array and it appears on the courses page and, if `featured: true`, on the home page.
Change a timing and it updates in the header, on the home page, on the Rajyoga page
and on the events page at once.

### Editing a page

Pages are ordinary HTML with a JSON front-matter comment at the top:

```html
<!--meta
{ "title": "About", "nav": "about", "description": "…" }
-->
```

The template syntax is deliberately small: `{{ value }}`, `{{{ raw }}}`,
`{{> partial }}`, `{{#each list}}…{{/each}}`, `{{#if x}}…{{/if}}`, `{{#unless x}}`.
That is the whole language — it is documented at the top of `build.js`.

### Adding a page

Drop a file in `src/pages/`, give it front-matter, and add an entry to the `nav`
array in `src/data/site.js`. The sitemap picks it up automatically.

## Images

The artwork in `src/assets/img/` is generated — original mandala, lotus and lamp
compositions in the site's palette, produced by `node tools/make-art.js`. They exist
so the site looks finished before anyone has been round with a camera.

**Replace them with real photographs of the centre as soon as you have them.** Keep the
same filenames and everything picks them up: `hero`, `welcome`, `meditation`,
`gallery-1` … `gallery-8`, `event-*`, `course-*`. Photographs of the hall, the morning
class, festival evenings and the people who teach there will do more for this site than
any amount of design.

`og-default.png` is the image that appears when the site is shared on WhatsApp or
Facebook. A photograph of the building, 1200 × 630, would be better than the generated one.

## Design

- **Type** — Cormorant Garamond for headings, Inter for text, Noto Serif Devanagari for
  `ॐ शान्ति`. Loaded from Google Fonts, with system fallbacks that hold the layout if
  the fonts are blocked or slow.
- **Colour** — deep peacock blue for stillness, gold for light, warm paper for the page.
  All defined as custom properties at the top of `src/assets/css/styles.css`.
- **Motion** — sections fade in on scroll, but only when JavaScript is running. With
  JavaScript off, every page renders complete.
- **Accessibility** — skip link, visible focus rings, keyboard-trapped mobile drawer and
  lightbox, `prefers-reduced-motion` respected, one `<h1>` per page, alt text on every
  image. Checked by `tools/check.js`.
- **Responsive** — verified free of horizontal overflow from 320px to 1600px by
  `tools/measure.js`, which renders each page in headless Chromium and measures it.

## Deploying

### GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`. Enable it
once under **Settings → Pages → Source → GitHub Actions**. For a custom domain, add the
domain under Settings → Pages and commit a `CNAME` file containing it to `src/assets/`.

### Anywhere else

`node build.js`, then upload the contents of `dist/`. There is no server-side code.

## The contact form

The form currently has no backend: submitting it opens the visitor's mail app with the
message pre-filled and addressed to the centre. That works, but it loses anyone without
a configured mail client.

To take submissions properly, add an `action` to the `<form>` in
`src/pages/contact.html` pointing at a form service (Formspree, Netlify Forms, Google
Forms). The fallback in `src/assets/js/main.js` stands down automatically as soon as an
`action` is present.

---

Every class and course at every Brahma Kumaris centre is free. Nothing on this site
should ever suggest otherwise.
