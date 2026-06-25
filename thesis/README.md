# Req2UI — Graduation Thesis

LaTeX source for the Req2UI thesis: *From Natural Language to Secure Software Artifacts Using AI* (AASTMT, 2025–2026).

## Structure
```
thesis/
├─ main.tex            # full thesis (compile this)
├─ README.md
├─ figures/            # rendered PNGs used by main.tex
│  ├─ architecture.png
│  ├─ context.png
│  ├─ class.png
│  ├─ usecase.png
│  ├─ sequence.png
│  ├─ activity.png
│  ├─ uicode.png       # Stage 10 UI-code generation pipeline
│  └─ src/             # editable PlantUML sources (.puml)
├─ tools/
│  └─ plantuml.jar     # PlantUML renderer (gitignored; auto-downloaded on first render)
└─ render-figures.ps1  # re-render all figures from src/
```

## Compiling the thesis
No LaTeX toolchain is installed locally. Easiest options:

- **Overleaf (recommended):** upload the `thesis/` folder (or zip it), set the compiler to **pdfLaTeX**, and compile `main.tex`. The `figures/*.png` are referenced via `\graphicspath{{figures/}}`.
- **Local:** install MiKTeX (Windows), then run `latexmk -pdf main.tex` from this folder (run twice so the TOC / lists resolve).

## Editing / re-rendering the UML figures
The diagrams are generated from PlantUML sources in `figures/src/`. After editing a `.puml` file, re-render:

```powershell
./render-figures.ps1
```

This needs **Java** on PATH. The `tools/plantuml.jar` is gitignored (21 MB); the script
**auto-downloads it on first run** if missing, then uses the Smetana layout engine (no Graphviz required).

## Notes
- Figures reflect the **implemented** system (Groq for stages 1–9, Gemini for stage 10 UI code, Neon PostgreSQL, JWT auth, PDF/DOCX/CSV/LaTeX export), not the older OpenAI/Figma plan in the original draft.
- Sections marked `% TODO` in `main.tex` (Implementation, Testing, Conclusion, prototype screenshots, parts of Appendix A) are intentionally left as placeholders to fill in.
