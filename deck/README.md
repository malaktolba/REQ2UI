# Req2UI — Defense Decks

Two decks live here. **Use the Slidev one** — it's the current, code-based source.

```
deck/
├─ slidev/        ← PRIMARY. Code-based deck (Markdown + theme). Edit & rebuild here.
│  ├─ slides.md       all content (one block per slide) + speaker notes
│  ├─ style.css       design tokens (colors, cards) — change once, all slides follow
│  ├─ layouts/        cover / topic / statement layouts
│  ├─ public/         figures + AAST logo
│  └─ exports/        built PDF (Req2UI-Defense.pdf)
└─ legacy-pptx/   ← the earlier GLM-generated PowerPoint, kept as a fallback
   ├─ Req2UI-Defense.pptx   hand-editable in PowerPoint (image-free, text boxes)
   ├─ exports/Req2UI-Defense.pdf
   └─ README.md             review log for that file
```

## Which one to use?
- **Slidev (`slidev/`)** — recommended. Markdown content, version-controlled, rebuilds to
  PDF/HTML/PPTX in one command. Best for iterating as the project evolves. See
  `slidev/README.md` for dev/build/export commands.
- **legacy-pptx/** — keep only if you specifically need a *hand-editable PowerPoint* file.
  Its PPTX export from Slidev is image-per-slide, so this native PPTX remains the
  text-editable option. Content matches the Slidev deck after the fixes already applied.

## TL;DR to work on the live deck
```bash
cd deck/slidev
npm install
npm run dev      # edit slides.md with hot reload
npm run export   # → slidev/exports/Req2UI-Defense.pdf
```

> Note: `deck/Req2UI-Defense.pptx` may still exist as a duplicate of
> `legacy-pptx/Req2UI-Defense.pptx` (the original was locked/open when the folder was
> reorganized). Safe to delete once PowerPoint/OneDrive releases it.
