import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
  PageBreak, TableOfContents, Header, Footer, PageNumber, ShadingType,
} from "docx";
import { Resvg } from "@resvg/resvg-js";
import JSZip from "jszip";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Optional client/document context captured before generation, surfaced on the
// exported title pages. Author/contact/version are pre-filled with account
// defaults upstream; organization/industry/audience may be absent.
export interface ExportMeta {
  organization?: string;
  industry?: string;
  audience?: string;
  author?: string;
  contact_email?: string;
  version?: string;
}

/** [label, value] pairs for the title page, skipping any empty field. */
function metaRows(meta: ExportMeta | undefined): [string, string][] {
  if (!meta) return [];
  const rows: [string, string][] = [];
  if (meta.organization) rows.push(["Prepared for", meta.organization]);
  if (meta.industry) rows.push(["Industry", meta.industry]);
  if (meta.author) rows.push(["Prepared by", meta.author]);
  if (meta.contact_email) rows.push(["Contact", meta.contact_email]);
  if (meta.version) rows.push(["Version", meta.version]);
  return rows;
}

function flattenArtifacts(artifacts: any[]): Record<string, any> {
  return Object.fromEntries(artifacts.map((a: any) => [a.type, a.content]));
}

// Bundled fonts so SVG <text> renders on hosts with no system fonts (e.g. the
// minimal Render Linux container, where loadSystemFonts finds nothing and the
// Mermaid diagram labels come out blank). Lives at backend/assets/fonts — two
// levels up from this file in both dev (src/services) and prod (dist/services).
const FONT_DIR = path.join(__dirname, "..", "..", "assets", "fonts");
const FONT_FILES = [
  path.join(FONT_DIR, "DejaVuSans.ttf"),
  path.join(FONT_DIR, "DejaVuSans-Bold.ttf"),
];

async function svgToPng(svg: string): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    background: "white",
    fitTo: { mode: "width", value: 900 },
    // Load the bundled fonts and make DejaVu Sans the default so resvg
    // substitutes it for the Mermaid-requested families ("trebuchet ms",
    // verdana, …) it can't find — otherwise labels render wordless.
    font: {
      loadSystemFonts: true,
      fontFiles: FONT_FILES,
      defaultFontFamily: "DejaVu Sans",
    },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}


// ─── DOCX ────────────────────────────────────────────────────────────────────
//
// The Word export deliberately mirrors the LaTeX report (same chapter order,
// the same colour-headed requirement tables, title page, TOC and page numbers)
// so the two formats stay visually consistent. Both renderers read the same
// artifact fields, so any change to one (e.g. a new requirement column) should
// be mirrored in the other.

// Thesis palette, shared with the LaTeX export's \definecolor block.
const DX_NAVY = "1A3A52";
const DX_BLUE = "2563EB";
const DX_GREY = "5D6B78";
const DX_ROW = "F4F6F9";
const DX_TEXT = "243042";

// A run of inline text with optional emphasis; a Line is a list of runs that
// share one paragraph; a Cell is a stack of Lines (paragraph breaks within a cell).
type DxRun = { text: string; bold?: boolean; italic?: boolean };
type DxCell = DxRun[][];

const txt = (text: string): DxCell => [[{ text }]];
const bold = (text: string): DxCell => [[{ text, bold: true }]];

function dxParas(cell: DxCell, color = DX_TEXT): Paragraph[] {
  return cell.map(
    (line) =>
      new Paragraph({
        spacing: { after: 20 },
        children: line.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic, size: 18, color })),
      })
  );
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const THIN = { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" } as const;

/** A page-breakable table with a navy header row and light zebra striping. */
function dxTable(headers: string[], widths: number[], rows: DxCell[][]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h, i) =>
        new TableCell({
          width: { size: widths[i], type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: DX_NAVY },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [
            new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18 })] }),
          ],
        })
    ),
  });

  const bodyRows = rows.map(
    (cells, ri) =>
      new TableRow({
        children: cells.map(
          (cell, ci) =>
            new TableCell({
              width: { size: widths[ci], type: WidthType.PERCENTAGE },
              shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, color: "auto", fill: DX_ROW } : undefined,
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: dxParas(cell),
            })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: THIN, bottom: THIN, left: NO_BORDER, right: NO_BORDER, insideHorizontal: THIN, insideVertical: NO_BORDER },
    rows: [headerRow, ...bodyRows],
  });
}

/** Manually-numbered heading (the LaTeX `report` numbers chapters/sections; Word
 *  built-in heading styles drive the TOC, so we supply the numbers as text). */
function dxHeading(text: string, level: 1 | 2): Paragraph {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    spacing: { before: level === 1 ? 240 : 160, after: 80 },
    children: [new TextRun({ text, bold: true, color: level === 1 ? DX_NAVY : DX_BLUE })],
  });
}

const dxPara = (text: string, opts: { italic?: boolean; color?: string } = {}): Paragraph =>
  new Paragraph({
    spacing: { after: 120 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, italics: opts.italic, size: 20, color: opts.color ?? DX_TEXT })],
  });

const dxBullets = (items: string[]): Paragraph[] =>
  items.map((it) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: it, size: 20, color: DX_TEXT })] }));

export async function generateDOCX(
  projectName: string,
  artifacts: any[],
  meta?: ExportMeta
): Promise<Buffer> {
  const data = flattenArtifacts(artifacts);
  const ov = data.extraction ?? {};
  const date = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  const C: any[] = [];

  // ── Title page ─────────────────────────────────────────────────────────────
  const centered = (children: TextRun[]) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children });
  C.push(
    new Paragraph({ spacing: { before: 2400 } }),
    centered([new TextRun({ text: "Software Requirements Specification", bold: true, size: 30, color: DX_NAVY })]),
    centered([new TextRun({ text: projectName, bold: true, size: 56, color: DX_NAVY })]),
    centered([new TextRun({ text: "Functional, Non-Functional & Security Requirements", italics: true, size: 24, color: DX_BLUE } as any)]),
    centered([new TextRun({ text: "Prepared in accordance with IEEE Std 830-1998.", size: 22, color: DX_TEXT })]),
    centered([new TextRun({ text: `Generated ${date}`, size: 20, color: DX_GREY })]),
    ...metaRows(meta).map(([label, value]) =>
      centered([
        new TextRun({ text: `${label}: `, bold: true, size: 20, color: DX_NAVY }),
        new TextRun({ text: value, size: 20, color: DX_TEXT }),
      ])
    ),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── Abstract & contents ────────────────────────────────────────────────────
  if (ov.abstract || ov.system_summary) {
    C.push(dxHeading("Abstract", 1), dxPara(ov.abstract ?? ov.system_summary));
  }
  C.push(
    dxHeading("Contents", 1),
    new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 1. Introduction ────────────────────────────────────────────────────────
  C.push(dxHeading("1. Introduction", 1));
  C.push(dxHeading("1.1 Purpose", 2),
    dxPara(`This document specifies the requirements for ${projectName}. It is prepared in accordance with IEEE Std 830-1998 and serves as the authoritative reference for the design, development, and testing of the system. Requirements prefixed FR- are functional, NFR- non-functional, and SR- security requirements mapped to the OWASP Top 10 (2021).`));
  let s1 = 1;
  if (ov.motivation) C.push(dxHeading(`1.${++s1} Motivation`, 2), dxPara(ov.motivation));
  if (ov.problem_statement) C.push(dxHeading(`1.${++s1} Problem Statement`, 2), dxPara(ov.problem_statement));
  if (ov.scope ?? ov.system_summary) C.push(dxHeading(`1.${++s1} Scope`, 2), dxPara(ov.scope ?? ov.system_summary));
  if (ov.objectives?.length) C.push(dxHeading(`1.${++s1} Objectives`, 2), ...dxBullets(ov.objectives));
  if (ov.actors?.length) C.push(dxHeading(`1.${++s1} Intended Users`, 2), ...dxBullets(ov.actors));

  // ── 2. Overall Description ─────────────────────────────────────────────────
  C.push(dxHeading("2. Overall Description", 1));
  let s2 = 0;
  if (ov.product_perspective ?? ov.system_summary) C.push(dxHeading(`2.${++s2} Product Perspective`, 2), dxPara(ov.product_perspective ?? ov.system_summary));
  if (ov.actors?.length) C.push(dxHeading(`2.${++s2} User Characteristics`, 2), ...dxBullets(ov.actors));
  if (ov.assumptions?.length) C.push(dxHeading(`2.${++s2} Assumptions`, 2), ...dxBullets(ov.assumptions));
  if (ov.constraints?.length) C.push(dxHeading(`2.${++s2} Constraints`, 2), ...dxBullets(ov.constraints));
  if (ov.extracted?.length) C.push(dxHeading(`2.${++s2} Identified System Needs`, 2), ...dxBullets(ov.extracted));

  // ── 3. Specific Requirements ───────────────────────────────────────────────
  C.push(dxHeading("3. Specific Requirements", 1));

  const frs = data.functional_requirements?.requirements ?? [];
  if (frs.length) {
    C.push(dxHeading("3.1 Functional Requirements (IEEE 830)", 2),
      dxPara("The following functional requirements define the behaviour the system shall exhibit."));
    const rows: DxCell[][] = frs.map((r: any) => {
      const req: DxRun[][] = [];
      if (r.title) req.push([{ text: r.title, bold: true }]);
      req.push([{ text: r.description ?? "" }]);
      if (r.acceptance_criteria?.length) req.push([{ text: "Acceptance: ", italic: true }, { text: r.acceptance_criteria.join("; ") }]);
      return [bold(r.id ?? ""), txt(r.priority ?? ""), req];
    });
    C.push(dxTable(["ID", "Priority", "Requirement"], [15, 15, 70], rows));
  }

  const nfrs = data.non_functional_requirements?.requirements ?? [];
  if (nfrs.length) {
    C.push(dxHeading("3.2 Non-Functional Requirements", 2));
    const rows: DxCell[][] = nfrs.map((r: any) => {
      const req: DxRun[][] = [];
      if (r.title) req.push([{ text: r.title, bold: true }]);
      req.push([{ text: r.description ?? "" }]);
      if (r.metric) req.push([{ text: "Metric: ", italic: true }, { text: r.metric }]);
      return [bold(r.id ?? ""), txt(r.category ?? ""), req];
    });
    C.push(dxTable(["ID", "Category", "Requirement"], [15, 22, 63], rows));
  }

  const srs = data.security_requirements?.requirements ?? [];
  if (srs.length) {
    C.push(dxHeading("3.3 Security Requirements (OWASP Top 10)", 2));
    const rows: DxCell[][] = srs.map((r: any) => {
      const req: DxRun[][] = [];
      if (r.title) req.push([{ text: r.title, bold: true }]);
      req.push([{ text: r.description ?? "" }]);
      if (r.priority) req.push([{ text: "Priority: ", italic: true }, { text: r.priority }]);
      if (r.controls?.length) req.push([{ text: "Controls: ", italic: true }, { text: r.controls.join("; ") }]);
      return [bold(r.id ?? ""), txt(r.owasp_category ?? ""), req];
    });
    C.push(dxTable(["ID", "OWASP Category", "Requirement"], [14, 26, 60], rows));
  }

  // ── 4. Functional Test Cases ───────────────────────────────────────────────
  const tcs = data.functional_test_cases?.test_cases ?? [];
  if (tcs.length) {
    C.push(dxHeading("4. Functional Test Cases (IEEE 829)", 1));
    const rows: DxCell[][] = tcs.map((tc: any) => {
      const steps: DxRun[][] = [];
      if (tc.preconditions) steps.push([{ text: "Pre: ", italic: true }, { text: tc.preconditions }]);
      (tc.steps ?? []).forEach((s: string, i: number) => steps.push([{ text: `${i + 1}. ${s}` }]));
      const covers = [tc.fr_id ? `Covers ${tc.fr_id}` : "", tc.priority ? `(${tc.priority})` : ""].filter(Boolean).join(" ");
      return [bold(tc.id ?? ""), txt(covers), steps.length ? steps : txt(""), txt(tc.expected_result ?? "")];
    });
    C.push(dxTable(["ID", "Covers", "Steps", "Expected Result"], [13, 18, 39, 30], rows));
  }

  // ── 5. Security Test Cases ─────────────────────────────────────────────────
  const stcs = data.security_test_cases?.test_cases ?? [];
  if (stcs.length) {
    C.push(dxHeading("5. Security Test Cases", 1));
    const rows: DxCell[][] = stcs.map((tc: any) => {
      const attack: DxRun[][] = [];
      if (tc.attack_vector) attack.push([{ text: tc.attack_vector }]);
      (tc.steps ?? []).forEach((s: string, i: number) => attack.push([{ text: `${i + 1}. ${s}` }]));
      const covers = [tc.sr_id ? `Covers ${tc.sr_id}` : "", tc.severity ? `(${tc.severity})` : ""].filter(Boolean).join(" ");
      return [bold(tc.id ?? ""), txt(covers), attack.length ? attack : txt(""), txt(tc.expected_result ?? "")];
    });
    C.push(dxTable(["ID", "Covers", "Attack Vector & Steps", "Expected Result"], [13, 18, 39, 30], rows));
  }

  // ── 6. Traceability Matrix ─────────────────────────────────────────────────
  const tm = data.traceability_matrix;
  if (tm) {
    C.push(dxHeading("6. Traceability Matrix", 1));
    const cov = tm.coverage;
    if (cov) {
      C.push(dxPara(`Requirement coverage: ${cov.covered_frs ?? ""} of ${cov.total_frs ?? ""} functional requirements traced across ${cov.total_tcs ?? ""} test cases (${cov.percentage ?? ""}%).`));
    }
    const rows: DxCell[][] = (tm.matrix ?? []).map((row: any) => [
      bold(row.fr_id ?? ""),
      txt(row.fr_title ?? ""),
      txt((row.test_cases ?? []).join(", ")),
      txt((row.security_reqs ?? []).join(", ")),
    ]);
    if (rows.length) C.push(dxTable(["FR", "Title", "Test Cases", "Security"], [14, 40, 26, 20], rows));
  }

  // ── 7. UML Diagrams ────────────────────────────────────────────────────────
  const diagrams = data.uml_diagrams?.diagrams ?? [];
  if (diagrams.length) {
    C.push(dxHeading("7. UML Diagrams", 1));
    for (const d of diagrams) {
      C.push(dxHeading(d.title ?? "Diagram", 2));
      if (d.description) C.push(dxPara(d.description));
      // No rasterised image on this (header-less GET) route, so the Mermaid source
      // is shown in a monospaced block — matching the LaTeX verbatim fallback.
      for (const ml of String(d.mermaid ?? "").split("\n")) {
        C.push(new Paragraph({ children: [new TextRun({ text: ml, font: "Consolas", size: 16, color: DX_GREY })] }));
      }
    }
  }

  // ── Appendix A: Generated UI Screens ───────────────────────────────────────
  const screens = data.ui_code?.screens ?? [];
  if (screens.length) {
    C.push(dxHeading("Appendix A. Generated UI Screens", 1),
      dxPara("The platform generated the following screens as standalone HTML + Tailwind CSS pages."));
    const rows: DxCell[][] = screens.map((sc: any) => [
      txt(sc.id ?? sc.name ?? ""), txt(sc.route ?? ""), txt(sc.description ?? ""),
    ]);
    C.push(dxTable(["Screen", "Route", "Description"], [22, 26, 52], rows));
  }

  const doc = new Document({
    sections: [{
      properties: {},
      headers: {
        default: new Header({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${projectName} — SRS`, size: 16, color: DX_GREY })] })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", size: 16, color: DX_GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: DX_GREY })] })],
        }),
      },
      children: C,
    }],
  });
  return Packer.toBuffer(doc);
}

// ─── LaTeX ───────────────────────────────────────────────────────────────────

function latexEsc(s: string): string {
  return String(s ?? "")
    .replace(/[\r\n]+/g, " ") // collapse newlines so table cells never break
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/→/g, "$\\rightarrow$")
    .replace(/✓/g, "$\\checkmark$");
}

/**
 * Builds a page-breakable, navy-header table (xltabular). Cell strings are
 * inserted as-is so callers can include intended LaTeX markup (e.g. \newline);
 * header strings are escaped here.
 */
function latexLongTable(colspec: string, headers: string[], rows: string[][], caption: string): string[] {
  const headerRow =
    "\\rowcolor{procastnavy}" +
    headers.map((h) => `\\textcolor{white}{\\textbf{${latexEsc(h)}}}`).join(" & ") +
    " \\\\";
  return [
    `\\begin{xltabular}{\\textwidth}{${colspec}}`,
    `\\caption{${latexEsc(caption)}}\\\\`,
    "\\toprule",
    headerRow,
    "\\midrule",
    "\\endfirsthead",
    "\\toprule",
    headerRow,
    "\\midrule",
    "\\endhead",
    "\\bottomrule",
    "\\endlastfoot",
    ...rows.map((r) => r.join(" & ") + " \\\\"),
    "\\end{xltabular}",
    "",
  ];
}

/**
 * Renders the SRS as a thesis-styled LaTeX `report`: a title page, front matter
 * (declaration, abstract, abbreviations), a table of contents, and numbered
 * chapters with navy/blue headings and colour-headed tables. Compile with
 * pdflatex (run twice for the table of contents).
 */
export function generateLaTeX(
  projectName: string,
  artifacts: any[],
  meta?: ExportMeta,
  // Maps a UML diagram id → the PNG filename written alongside the .tex, so the
  // compiled PDF embeds the rendered diagram instead of raw Mermaid source.
  diagramImages?: Record<string, string>
): string {
  const data = flattenArtifacts(artifacts);
  const e = latexEsc;
  const date = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  const name = e(projectName);
  const ov = data.extraction ?? {};
  const summary = ov.system_summary ? e(ov.system_summary) : "";
  // Narrative front-matter (generated in Stage 1); fall back to the summary so
  // older projects without the richer fields still export cleanly.
  const abstract = ov.abstract ? e(ov.abstract) : summary;
  const motivation = ov.motivation ? e(ov.motivation) : "";
  const problem = ov.problem_statement ? e(ov.problem_statement) : "";
  const scope = ov.scope ? e(ov.scope) : summary;
  const perspective = ov.product_perspective ? e(ov.product_perspective) : summary;
  const objectives: string[] = Array.isArray(ov.objectives) ? ov.objectives : [];
  const assumptions: string[] = Array.isArray(ov.assumptions) ? ov.assumptions : [];
  const constraints: string[] = Array.isArray(ov.constraints) ? ov.constraints : [];
  const L: string[] = [];

  // ── Preamble ───────────────────────────────────────────────────────────────
  L.push(
    "\\documentclass[11pt,a4paper]{report}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{lmodern}",
    "\\usepackage[a4paper,margin=1in]{geometry}",
    "\\usepackage[table]{xcolor}",
    "\\usepackage{booktabs}",
    "\\usepackage{array}",
    "\\usepackage{tabularx}",
    "\\usepackage{xltabular}",
    "\\usepackage{ragged2e}",
    "\\usepackage{enumitem}",
    "\\usepackage{caption}",
    "\\usepackage{graphicx}",
    "\\usepackage{float}",
    "\\usepackage{titlesec}",
    "\\usepackage{fancyhdr}",
    "",
    "\\definecolor{procastnavy}{HTML}{1A3A52}",
    "\\definecolor{procastblue}{HTML}{2563EB}",
    "\\definecolor{procastgrey}{HTML}{5D6B78}",
    "\\definecolor{rowgrey}{HTML}{F4F6F9}",
    "",
    "\\usepackage{hyperref}",
    "\\hypersetup{colorlinks=true,linkcolor=procastnavy,urlcolor=procastblue,citecolor=procastnavy}",
    "",
    "\\titleformat{\\chapter}[display]{\\normalfont\\huge\\bfseries\\color{procastnavy}}{\\chaptertitlename\\ \\thechapter}{14pt}{\\Huge}",
    "\\titleformat{\\section}{\\normalfont\\Large\\bfseries\\color{procastnavy}}{\\thesection}{1em}{}",
    "\\titleformat{\\subsection}{\\normalfont\\large\\bfseries\\color{procastblue}}{\\thesubsection}{1em}{}",
    "",
    "\\pagestyle{fancy}",
    "\\fancyhf{}",
    "\\renewcommand{\\headrulewidth}{0.4pt}",
    `\\fancyhead[R]{\\small\\color{procastgrey}${name} --- SRS}`,
    "\\fancyfoot[C]{\\small\\color{procastgrey}Page \\thepage}",
    "\\captionsetup{font={small,it},labelfont={color=procastnavy}}",
    "\\setlist{leftmargin=1.6em,itemsep=2pt,topsep=3pt}",
    "\\renewcommand{\\arraystretch}{1.3}",
    "",
    "\\begin{document}",
    ""
  );

  // ── Title page ─────────────────────────────────────────────────────────────
  L.push(
    "\\begin{titlepage}",
    "\\centering",
    "\\vspace*{2cm}",
    "{\\large\\bfseries\\color{procastnavy} Software Requirements Specification}\\\\[2.5em]",
    "\\rule{\\linewidth}{0.4pt}\\\\[1.2em]",
    `{\\Huge\\bfseries\\color{procastnavy} ${name}}\\\\[0.8em]`,
    "{\\large\\itshape\\color{procastblue} Functional, Non-Functional \\& Security Requirements}\\\\[1.2em]",
    "\\rule{\\linewidth}{0.4pt}\\\\[2.5em]",
    "{\\large A Software Requirements Specification prepared in accordance with IEEE Std 830-1998.}\\\\[2em]",
    `{\\color{procastgrey} Generated ${e(date)}}\\\\[1.5em]`,
    // Document-control block: one centered line per supplied field.
    ...metaRows(meta).map(
      ([label, value]) => `{\\bfseries\\color{procastnavy} ${e(label)}:} ${e(value)}\\\\[0.3em]`
    ),
    "\\vfill",
    "{\\color{procastgrey} Auto-generated by Req2UI}",
    "\\end{titlepage}",
    ""
  );

  // ── Declaration ────────────────────────────────────────────────────────────
  L.push(
    "\\chapter*{Declaration of Originality}",
    "\\addcontentsline{toc}{chapter}{Declaration of Originality}",
    "\\justifying",
    `This Software Requirements Specification for \\textit{\`\`${name}''} documents the functional, non-functional, and security requirements of the system. It was produced from a structured requirements-analysis pipeline and is intended to serve as the authoritative reference for the system's design, implementation, and testing. All requirements are derived from the supplied project description and are organised following the IEEE~830 recommended practice.`,
    ""
  );

  // ── Abstract ───────────────────────────────────────────────────────────────
  if (abstract) {
    L.push(
      "\\chapter*{Abstract}",
      "\\addcontentsline{toc}{chapter}{Abstract}",
      "\\justifying",
      abstract,
      ""
    );
  }

  // ── Abbreviations ──────────────────────────────────────────────────────────
  L.push(
    "\\chapter*{Abbreviations}",
    "\\addcontentsline{toc}{chapter}{Abbreviations}",
    "\\begin{description}[leftmargin=!,labelwidth=3.2cm,style=nextline,font=\\bfseries\\color{procastnavy}]",
    "\\item[SRS] Software Requirements Specification.",
    "\\item[FR] Functional Requirement.",
    "\\item[NFR] Non-Functional Requirement.",
    "\\item[SR] Security Requirement (mapped to the OWASP Top 10, 2021).",
    "\\item[TC] Functional Test Case (IEEE 829).",
    "\\item[STC] Security Test Case.",
    "\\item[OWASP] Open Worldwide Application Security Project.",
    "\\item[UML] Unified Modeling Language.",
    "\\item[IEEE 830] IEEE Recommended Practice for Software Requirements Specifications.",
    "\\item[IEEE 829] IEEE Standard for Software and System Test Documentation.",
    "\\end{description}",
    "",
    "\\tableofcontents",
    "\\listoftables",
    ""
  );

  // ── Chapter 1: Introduction ────────────────────────────────────────────────
  L.push(
    "\\chapter{Introduction}",
    "\\section{Purpose}",
    "\\justifying",
    `This document specifies the requirements for \\textbf{${name}}. It is prepared in accordance with IEEE~Std~830-1998 and serves as the authoritative reference for the design, development, and testing of the system. Requirements prefixed \\texttt{FR-} are functional, \\texttt{NFR-} non-functional, and \\texttt{SR-} security requirements mapped to the OWASP Top~10 (2021).`,
    ""
  );
  if (motivation) L.push("\\section{Motivation}", "\\justifying", motivation, "");
  if (problem) L.push("\\section{Problem Statement}", "\\justifying", problem, "");
  if (scope) L.push("\\section{Scope}", "\\justifying", scope, "");
  if (objectives.length) {
    L.push("\\section{Objectives}", "\\begin{enumerate}");
    for (const o of objectives) L.push(`\\item ${e(o)}`);
    L.push("\\end{enumerate}", "");
  }
  if (ov.actors?.length) {
    L.push("\\section{Intended Users}", "\\begin{itemize}");
    for (const a of ov.actors) L.push(`\\item ${e(a)}`);
    L.push("\\end{itemize}", "");
  }

  // ── Chapter 2: Overall Description ─────────────────────────────────────────
  L.push("\\chapter{Overall Description}");
  if (perspective) L.push("\\section{Product Perspective}", "\\justifying", perspective, "");
  if (ov.actors?.length) {
    L.push("\\section{User Characteristics}", "\\begin{itemize}");
    for (const a of ov.actors) L.push(`\\item ${e(a)}`);
    L.push("\\end{itemize}", "");
  }
  if (assumptions.length) {
    L.push("\\section{Assumptions}", "\\begin{itemize}");
    for (const a of assumptions) L.push(`\\item ${e(a)}`);
    L.push("\\end{itemize}", "");
  }
  if (constraints.length) {
    L.push("\\section{Constraints}", "\\begin{itemize}");
    for (const c of constraints) L.push(`\\item ${e(c)}`);
    L.push("\\end{itemize}", "");
  }
  if (ov.extracted?.length) {
    L.push("\\section{Identified System Needs}", "\\begin{enumerate}");
    for (const r of ov.extracted) L.push(`\\item ${e(r)}`);
    L.push("\\end{enumerate}", "");
  }

  // ── Chapter 3: Specific Requirements ───────────────────────────────────────
  L.push("\\chapter{Specific Requirements}");

  const frs = data.functional_requirements?.requirements ?? [];
  if (frs.length) {
    L.push(
      "\\section{Functional Requirements (IEEE 830)}",
      "\\justifying The following functional requirements define the behaviour the system shall exhibit.",
      ""
    );
    const rows = frs.map((r: any) => {
      let desc = r.title ? `\\textbf{${e(r.title)}}\\newline ` : "";
      desc += e(r.description ?? "");
      if (r.acceptance_criteria?.length) desc += `\\newline\\textit{Acceptance:} ${e(r.acceptance_criteria.join("; "))}`;
      return [e(r.id ?? ""), e(r.priority ?? ""), desc];
    });
    L.push(...latexLongTable(">{\\bfseries}p{1.8cm} p{1.6cm} X", ["ID", "Priority", "Requirement"], rows, "Functional requirements."));
  }

  const nfrs = data.non_functional_requirements?.requirements ?? [];
  if (nfrs.length) {
    L.push("\\section{Non-Functional Requirements}", "");
    const rows = nfrs.map((r: any) => {
      let desc = r.title ? `\\textbf{${e(r.title)}}\\newline ` : "";
      desc += e(r.description ?? "");
      if (r.metric) desc += `\\newline\\textit{Metric:} ${e(r.metric)}`;
      return [e(r.id ?? ""), e(r.category ?? ""), desc];
    });
    L.push(...latexLongTable(">{\\bfseries}p{1.8cm} p{2.6cm} X", ["ID", "Category", "Requirement"], rows, "Non-functional requirements."));
  }

  const srs = data.security_requirements?.requirements ?? [];
  if (srs.length) {
    L.push("\\section{Security Requirements (OWASP Top 10)}", "");
    const rows = srs.map((r: any) => {
      let desc = r.title ? `\\textbf{${e(r.title)}}\\newline ` : "";
      desc += e(r.description ?? "");
      if (r.priority) desc += `\\newline\\textit{Priority:} ${e(r.priority)}`;
      if (r.controls?.length) desc += `\\newline\\textit{Controls:} ${e(r.controls.join("; "))}`;
      return [e(r.id ?? ""), e(r.owasp_category ?? ""), desc];
    });
    L.push(...latexLongTable(">{\\bfseries}p{1.6cm} p{3cm} X", ["ID", "OWASP Category", "Requirement"], rows, "Security requirements."));
  }

  // ── Chapter 4: Functional Test Cases ───────────────────────────────────────
  const tcs = data.functional_test_cases?.test_cases ?? [];
  if (tcs.length) {
    L.push("\\chapter{Functional Test Cases (IEEE 829)}", "");
    const rows = tcs.map((tc: any) => {
      let steps = (tc.steps ?? []).map((s: string, i: number) => `${i + 1}. ${e(s)}`).join("\\newline");
      if (tc.preconditions) steps = `\\textit{Pre:} ${e(tc.preconditions)}\\newline${steps}`;
      const covers = [tc.fr_id ? `Covers ${e(tc.fr_id)}` : "", tc.priority ? `(${e(tc.priority)})` : ""].filter(Boolean).join(" ");
      return [e(tc.id ?? ""), covers, steps, e(tc.expected_result ?? "")];
    });
    L.push(...latexLongTable(">{\\bfseries}p{1.6cm} p{2.2cm} X X", ["ID", "Covers", "Steps", "Expected Result"], rows, "Functional test cases."));
  }

  // ── Chapter 5: Security Test Cases ─────────────────────────────────────────
  const stcs = data.security_test_cases?.test_cases ?? [];
  if (stcs.length) {
    L.push("\\chapter{Security Test Cases}", "");
    const rows = stcs.map((tc: any) => {
      const steps = (tc.steps ?? []).map((s: string, i: number) => `${i + 1}. ${e(s)}`).join("\\newline");
      let attack = tc.attack_vector ? e(tc.attack_vector) : "";
      if (steps) attack += (attack ? "\\newline" : "") + steps;
      const covers = [tc.sr_id ? `Covers ${e(tc.sr_id)}` : "", tc.severity ? `(${e(tc.severity)})` : ""].filter(Boolean).join(" ");
      return [e(tc.id ?? ""), covers, attack, e(tc.expected_result ?? "")];
    });
    L.push(...latexLongTable(">{\\bfseries}p{1.6cm} p{2.2cm} X X", ["ID", "Covers", "Attack Vector & Steps", "Expected Result"], rows, "Security test cases."));
  }

  // ── Chapter 6: Traceability Matrix ─────────────────────────────────────────
  const tm = data.traceability_matrix;
  if (tm) {
    L.push("\\chapter{Traceability Matrix}", "\\justifying");
    const cov = tm.coverage;
    if (cov) {
      L.push(
        `Requirement coverage: ${e(String(cov.covered_frs ?? ""))} of ${e(String(cov.total_frs ?? ""))} functional requirements traced across ${e(String(cov.total_tcs ?? ""))} test cases (${e(String(cov.percentage ?? ""))}\\%).`,
        ""
      );
    }
    const rows = (tm.matrix ?? []).map((row: any) => [
      e(row.fr_id ?? ""),
      e(row.fr_title ?? ""),
      e((row.test_cases ?? []).join(", ")),
      e((row.security_reqs ?? []).join(", ")),
    ]);
    if (rows.length) {
      L.push(...latexLongTable(">{\\bfseries}p{1.6cm} X p{3.2cm} p{2.6cm}", ["FR", "Title", "Test Cases", "Security"], rows, "Requirements traceability matrix."));
    }
  }

  // ── Chapter 7: UML Diagrams ────────────────────────────────────────────────
  const diagrams = data.uml_diagrams?.diagrams ?? [];
  if (diagrams.length) {
    L.push("\\chapter{UML Diagrams}", "");
    for (const d of diagrams) {
      L.push(`\\section{${e(d.title ?? "Diagram")}}`);
      if (d.description) L.push("\\justifying", e(d.description), "");
      const img = d.id ? diagramImages?.[d.id] : undefined;
      if (img) {
        // Rendered diagram (PNG) embedded as a figure; width capped to the text block.
        L.push(
          "\\begin{figure}[H]",
          "\\centering",
          `\\includegraphics[width=\\linewidth,height=0.7\\textheight,keepaspectratio]{${img}}`,
          `\\caption{${e(d.title ?? "Diagram")}}`,
          "\\end{figure}",
          ""
        );
      } else {
        L.push("The diagram is expressed in Mermaid syntax:", "", "\\begin{verbatim}");
        for (const ml of String(d.mermaid ?? "").split("\n")) L.push(ml);
        L.push("\\end{verbatim}", "");
      }
    }
  }

  // ── Appendix A: Generated UI Screens ───────────────────────────────────────
  const screens = data.ui_code?.screens ?? [];
  if (screens.length) {
    L.push(
      "\\appendix",
      "\\chapter{Generated UI Screens}",
      "\\justifying",
      "The platform generated the following screens as standalone HTML + Tailwind CSS pages.",
      ""
    );
    const rows = screens.map((sc: any) => [e(sc.id ?? sc.name ?? ""), e(sc.route ?? ""), e(sc.description ?? "")]);
    L.push(...latexLongTable(">{\\bfseries}p{2.4cm} p{3cm} X", ["Screen", "Route", "Description"], rows, "Generated UI screens."));
  }

  L.push("\\end{document}");
  return L.join("\n");
}

// ─── LaTeX → PDF compilation ───────────────────────────────────────────────────

// Tectonic is a self-contained TeX engine: a single binary that fetches and
// caches the packages our preamble needs on first run.
//
// Resolution order (so PDF export works whether or not the host ships Tectonic):
//   1. TECTONIC_PATH, if set (e.g. the Docker image puts it on PATH as `tectonic`).
//   2. `tectonic` already on PATH.
//   3. Otherwise, on Linux, download the pinned static (musl) binary once into a
//      cache dir and reuse it. This lets the plain Node host (Render web service,
//      no Docker) produce PDFs without any infra changes.
const TECTONIC_VERSION = "0.16.9";
const TECTONIC_URL =
  process.env.TECTONIC_DOWNLOAD_URL ||
  `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz`;

/** True if `bin --version` runs successfully. */
async function tectonicWorks(bin: string): Promise<boolean> {
  try {
    await execFileAsync(bin, ["--version"], { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

// Memoised so concurrent exports share one resolution / download.
let tectonicResolution: Promise<string> | null = null;

async function resolveTectonic(): Promise<string> {
  const explicit = process.env.TECTONIC_PATH;
  if (explicit && (await tectonicWorks(explicit))) return explicit;
  if (await tectonicWorks("tectonic")) return "tectonic";

  // Self-bootstrap: only the linux-x86_64 build is fetched, so bail clearly
  // elsewhere (e.g. local Windows/macOS dev) rather than downloading a dud.
  if (process.platform !== "linux") {
    throw new Error(
      "tectonic not found and auto-download only supports linux-x64. Install Tectonic locally or set TECTONIC_PATH."
    );
  }

  const cacheDir = process.env.TECTONIC_CACHE_DIR || path.join(os.tmpdir(), "req2ui-tectonic");
  const bin = path.join(cacheDir, "tectonic");
  if (await tectonicWorks(bin)) return bin;

  await fs.mkdir(cacheDir, { recursive: true });
  const res = await fetch(TECTONIC_URL);
  if (!res.ok) throw new Error(`Tectonic download failed: HTTP ${res.status}`);
  const tarPath = path.join(cacheDir, "tectonic.tar.gz");
  await fs.writeFile(tarPath, Buffer.from(await res.arrayBuffer()));
  await execFileAsync("tar", ["-xzf", tarPath, "-C", cacheDir]);
  await fs.chmod(bin, 0o755);
  await fs.rm(tarPath, { force: true }).catch(() => {});

  if (!(await tectonicWorks(bin))) throw new Error("Tectonic downloaded but failed to run.");
  return bin;
}

/** Resolves a usable `tectonic` binary, downloading it once if necessary. */
function ensureTectonic(): Promise<string> {
  if (!tectonicResolution) {
    tectonicResolution = resolveTectonic().catch((err) => {
      tectonicResolution = null; // allow retry on a later request
      throw err;
    });
  }
  return tectonicResolution;
}

/**
 * Compiles the SRS to a print-quality PDF by rendering {@link generateLaTeX} with
 * Tectonic. UML diagram SVGs (captured client-side) are rasterised to PNG and
 * embedded as figures. Runs in a throwaway temp dir that is always cleaned up.
 *
 * Tectonic resolves the table of contents in a single invocation (no double
 * pass) and prints to stderr; a non-zero exit surfaces the TeX log to the caller.
 */
export async function compileLaTeX(
  projectName: string,
  artifacts: any[],
  meta?: ExportMeta,
  diagramSvgs?: Record<string, string>
): Promise<Buffer> {
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "req2ui-tex-"));
  try {
    // Rasterise each diagram SVG to a PNG in the work dir, keyed back to its id.
    const diagramImages: Record<string, string> = {};
    if (diagramSvgs) {
      let i = 0;
      for (const [id, svg] of Object.entries(diagramSvgs)) {
        if (!svg) continue;
        const file = `diagram_${i++}.png`;
        try {
          await fs.writeFile(path.join(workdir, file), await svgToPng(svg));
          diagramImages[id] = file;
        } catch {
          // A single bad SVG falls back to its Mermaid source in the PDF.
        }
      }
    }

    const tex = generateLaTeX(projectName, artifacts, meta, diagramImages);
    await fs.writeFile(path.join(workdir, "main.tex"), tex, "utf8");

    const tectonicBin = await ensureTectonic();
    try {
      await execFileAsync(
        tectonicBin,
        ["main.tex", "--outdir", workdir, "--chatter", "minimal"],
        { cwd: workdir, timeout: 120_000, maxBuffer: 16 * 1024 * 1024 }
      );
    } catch (err: any) {
      const detail = err?.stderr || err?.message || String(err);
      throw new Error(`LaTeX compilation failed: ${detail}`);
    }

    return fs.readFile(path.join(workdir, "main.pdf"));
  } finally {
    await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── LaTeX → Overleaf-ready ZIP bundle ─────────────────────────────────────────

/** Short, file-system-safe slug for the bundle's root folder and file names. */
function safeSlug(name: string): string {
  return (name || "project").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "project";
}

const OVERLEAF_README = (slug: string) =>
  `Req2UI — LaTeX source bundle
============================

This archive contains the full LaTeX source for your Software Requirements
Specification, plus the rendered UML diagrams as figures, ready to compile.

Contents
--------
  main.tex        The complete SRS document (IEEE 830, thesis-styled).
  figures/        Rendered UML diagrams (PNG) referenced by main.tex.

Compiling on Overleaf
---------------------
  1. Go to https://www.overleaf.com and choose "New Project" > "Upload Project".
  2. Upload this entire .zip file (do NOT unzip it first — Overleaf unpacks it).
  3. Open main.tex and set the compiler to "pdfLaTeX"
     (Menu > Settings > Compiler), then press "Recompile".

Compiling locally
-----------------
  pdflatex main.tex   (run twice so the table of contents resolves)
  — or —
  tectonic main.tex

Generated by Req2UI (${slug}).
`;

/**
 * Builds an Overleaf-ready .zip containing the SRS LaTeX source ({@link generateLaTeX})
 * plus the rendered UML diagrams as PNG figures under figures/, so the user can
 * upload it straight to Overleaf and compile to PDF without any missing-image
 * errors. UML SVGs (captured client-side) are rasterised to PNG here; diagrams
 * without an image gracefully fall back to their Mermaid source in the document.
 */
export async function generateLaTeXZip(
  projectName: string,
  artifacts: any[],
  meta?: ExportMeta,
  diagramSvgs?: Record<string, string>
): Promise<Buffer> {
  const zip = new JSZip();

  // Rasterise each diagram SVG to a PNG under figures/, keyed back to its id so
  // generateLaTeX can emit \includegraphics{figures/diagram_N.png}.
  const diagramImages: Record<string, string> = {};
  if (diagramSvgs) {
    let i = 0;
    for (const [id, svg] of Object.entries(diagramSvgs)) {
      if (!svg) continue;
      const rel = `figures/diagram_${i++}.png`;
      try {
        zip.file(rel, await svgToPng(svg));
        diagramImages[id] = rel;
      } catch {
        // A single bad SVG falls back to its Mermaid source in the document.
      }
    }
  }

  const tex = generateLaTeX(projectName, artifacts, meta, diagramImages);
  const slug = safeSlug(projectName);
  zip.file("main.tex", tex);
  zip.file("README.txt", OVERLEAF_README(slug));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export function generateCSV(artifacts: any[]): string {
  const data = flattenArtifacts(artifacts);
  const rows: string[][] = [["Section", "ID", "Title/Name", "Description/Content", "Extra"]];

  const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;

  // FRs
  (data.functional_requirements?.requirements ?? []).forEach((r: any) => {
    rows.push(["FR", r.id, r.title, r.description, `Priority: ${r.priority}`]);
  });

  // NFRs
  (data.non_functional_requirements?.requirements ?? []).forEach((r: any) => {
    rows.push(["NFR", r.id, r.title, r.description, `Category: ${r.category} | Metric: ${r.metric}`]);
  });

  // SRs
  (data.security_requirements?.requirements ?? []).forEach((r: any) => {
    rows.push(["SR", r.id, r.title, r.description, `OWASP: ${r.owasp_category} | Priority: ${r.priority}`]);
  });

  // Functional TCs
  (data.functional_test_cases?.test_cases ?? []).forEach((tc: any) => {
    rows.push(["TC", tc.id, tc.title, tc.expected_result, `Covers: ${tc.fr_id} | Priority: ${tc.priority}`]);
  });

  // Security TCs
  (data.security_test_cases?.test_cases ?? []).forEach((tc: any) => {
    rows.push(["STC", tc.id, tc.title, tc.expected_result, `Covers: ${tc.sr_id} | Severity: ${tc.severity}`]);
  });

  // Traceability
  (data.traceability_matrix?.matrix ?? []).forEach((row: any) => {
    rows.push(["TM", row.fr_id, row.fr_title, (row.test_cases ?? []).join("; "), (row.security_reqs ?? []).join("; ")]);
  });

  return rows.map((r) => r.map(esc).join(",")).join("\n");
}
