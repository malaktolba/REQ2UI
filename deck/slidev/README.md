# Req2UI — Defense Deck (Slidev)

Code-based, version-controlled presentation. Content is Markdown; design is a
shared theme. Edit `slides.md`, rebuild, done.

## Quick start
```bash
cd deck/slidev
npm install
npm run dev        # live editor at http://localhost:3030 (hot reload)
```

## Editing
- **All content lives in `slides.md`** — one Markdown block per slide, separated by `---`.
- Each slide's frontmatter sets its `layout`, `section` (top-right label), `title`, and `subtitle`.
- Speaker notes are the trailing `<!-- ... -->` comment in each slide (shown in presenter mode).
- Design tokens (colors, fonts, card styles) are centralised in **`style.css`** — change once,
  every slide follows. Reusable layouts live in `layouts/` (`cover`, `topic`, `statement`);
  the footer is `global-bottom.vue`.
- Images are in `public/` and referenced from root, e.g. `<img src="/architecture.png">`.
  They were copied from `thesis/figures/`; re-copy if those diagrams change.

## Building / exporting
```bash
npm run build        # static HTML site → dist/  (host anywhere, or open locally)
npm run export       # PDF → exports/Req2UI-Defense.pdf   (needs playwright-chromium)
npm run export:pptx  # PPTX (image-per-slide) → exports/Req2UI-Defense.pptx
npm run export:png   # one PNG per slide → exports/png/
```
> PDF/PPTX/PNG export uses a headless Chromium (`playwright-chromium`, installed as a
> dev dependency). The first run may download the browser binary. **Present from the
> HTML build or the dev server for the best result;** export to PDF for submission.

## Presenting
- `npm run dev`, then press **`p`** for presenter mode (notes + timer), **`f`** for fullscreen.
- Arrow keys / space to navigate. `o` opens the slide overview.

## Screenshots
- Real, live screenshots of the public pages (landing, login, register) are in
  `public/screens/` and shown on the **"The product, live"** slide.
- They were captured with **`shot.mjs`** (Playwright, headless Chromium):
  ```bash
  node shot.mjs https://req-2-ui.vercel.app        # all public routes
  node shot.mjs https://req-2-ui.vercel.app landing # one route
  ```
- The **authenticated** screens (Dashboard, Project Detail, Artifacts, UI Preview) on the
  "Inside the app" slide are framed **placeholders** — they need a logged-in session.
  To add them: capture the screens (any tool), save as
  `public/screens/dashboard.png` etc., then in `slides.md` swap the placeholder
  `<div class="ph">…</div>` for `<img class="bimg" src="/screens/dashboard.png" />`.

## Notes
- **27 slides**, dark slate + indigo theme matching the Req2UI product.
- Content is fact-checked against the codebase (pipeline stages, model split, security
  stack, 24 passing tests). The concurrency slide correctly shows stages 1–2 as
  sequential and 3–5 / 6–7 / 8–10 as the parallel groups.
- Added beyond the original deck: a worked **walkthrough** (one paragraph → full spec),
  a real-screens **product tour**, an **AI-generated-UI spotlight** (with a code sample),
  a **by-the-numbers** impact slide, a **manual-vs-Req2UI** value comparison, and a
  **references & standards** slide.
- Illustrative content (the walkthrough output, the traceability example, the
  manual-vs time figures) is labelled as such on-slide — keep it honest for the committee.
