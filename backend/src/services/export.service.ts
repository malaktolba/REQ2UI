import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { PassThrough } from "stream";
import { Resvg } from "@resvg/resvg-js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function flattenArtifacts(artifacts: any[]): Record<string, any> {
  return Object.fromEntries(artifacts.map((a: any) => [a.type, a.content]));
}

async function svgToPng(svg: string): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    background: "white",
    fitTo: { mode: "width", value: 900 },
    font: { loadSystemFonts: true },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}

interface IEEESection {
  title: string;
  level: 1 | 2 | 3;
  lines: string[];
  diagramId?: string; // if set, embed PNG from diagramSvgs instead of text lines
}

function ieeeSections(data: Record<string, any>): IEEESection[] {
  const sections: IEEESection[] = [];

  // ── 1. Introduction ───────────────────────────────────────────────────────
  sections.push({ level: 1, title: "1. Introduction", lines: [] });
  sections.push({
    level: 2, title: "1.1 Purpose", lines: [
      "This Software Requirements Specification (SRS) describes the functional and " +
      "non-functional requirements for the system. It is prepared in accordance with " +
      "IEEE Std 830-1998 and serves as the authoritative reference for system design, development, and testing.",
    ],
  });
  if (data.extraction?.system_summary) {
    sections.push({ level: 2, title: "1.2 Scope", lines: [data.extraction.system_summary] });
  }
  if (data.extraction?.actors?.length) {
    sections.push({ level: 2, title: "1.3 Intended Users", lines: [data.extraction.actors.join(", ")] });
  }
  sections.push({
    level: 2, title: "1.4 Document Conventions", lines: [
      "Requirements prefixed FR- are functional. NFR- are non-functional. " +
      "SR- are security requirements mapped to OWASP Top 10 (2021).",
    ],
  });

  // ── 2. Overall Description ────────────────────────────────────────────────
  sections.push({ level: 1, title: "2. Overall Description", lines: [] });
  if (data.extraction?.system_summary) {
    sections.push({ level: 2, title: "2.1 System Overview", lines: [data.extraction.system_summary] });
  }
  if (data.extraction?.actors?.length) {
    sections.push({ level: 2, title: "2.2 User Characteristics", lines: [data.extraction.actors.join(", ")] });
  }
  if (data.extraction?.extracted?.length) {
    sections.push({
      level: 2, title: "2.3 Identified System Needs",
      lines: data.extraction.extracted.map((r: string, i: number) => `${i + 1}. ${r}`),
    });
  }

  // ── 3. Specific Requirements ──────────────────────────────────────────────
  sections.push({ level: 1, title: "3. Specific Requirements", lines: [] });

  // 3.1 Functional Requirements
  if (data.functional_requirements?.requirements?.length) {
    sections.push({ level: 2, title: "3.1 Functional Requirements (IEEE 830)", lines: [] });
    data.functional_requirements.requirements.forEach((r: any, i: number) => {
      const lines: string[] = [
        `ID: ${r.id}    Priority: ${r.priority}`,
        `Description: ${r.description}`,
      ];
      if (r.acceptance_criteria?.length) {
        lines.push("Acceptance Criteria:");
        r.acceptance_criteria.forEach((c: string) => lines.push(`  ✓ ${c}`));
      }
      lines.push("");
      sections.push({ level: 3, title: `3.1.${i + 1}  ${r.id} — ${r.title}`, lines });
    });
  }

  // 3.2 Non-Functional Requirements
  if (data.non_functional_requirements?.requirements?.length) {
    sections.push({ level: 2, title: "3.2 Non-Functional Requirements", lines: [] });
    const cats = [...new Set(data.non_functional_requirements.requirements.map((r: any) => r.category))] as string[];
    cats.forEach((cat, ci) => {
      const catReqs = data.non_functional_requirements.requirements.filter((r: any) => r.category === cat);
      const lines: string[] = [];
      catReqs.forEach((r: any) => {
        lines.push(`[${r.id}] ${r.title}`);
        lines.push(`  ${r.description}`);
        if (r.metric) lines.push(`  Metric: ${r.metric}`);
        lines.push("");
      });
      sections.push({ level: 3, title: `3.2.${ci + 1}  ${cat}`, lines });
    });
  }

  // 3.3 Security Requirements
  if (data.security_requirements?.requirements?.length) {
    sections.push({ level: 2, title: "3.3 Security Requirements (OWASP Top 10)", lines: [] });
    data.security_requirements.requirements.forEach((r: any, i: number) => {
      const lines: string[] = [
        `Priority: ${r.priority}`,
        `OWASP: ${r.owasp_category}`,
        `Description: ${r.description}`,
      ];
      if (r.controls?.length) {
        lines.push("Security Controls:");
        r.controls.forEach((c: string) => lines.push(`  → ${c}`));
      }
      lines.push("");
      sections.push({ level: 3, title: `3.3.${i + 1}  ${r.id} — ${r.title}`, lines });
    });
  }

  // ── 4. Functional Test Cases ──────────────────────────────────────────────
  if (data.functional_test_cases?.test_cases?.length) {
    sections.push({ level: 1, title: "4. Functional Test Cases (IEEE 829)", lines: [] });
    data.functional_test_cases.test_cases.forEach((tc: any, i: number) => {
      const lines: string[] = [];
      if (tc.fr_id) lines.push(`Covers: ${tc.fr_id}    Priority: ${tc.priority}`);
      if (tc.preconditions) lines.push(`Preconditions: ${tc.preconditions}`);
      if (tc.steps?.length) {
        lines.push("Steps:");
        tc.steps.forEach((s: string, si: number) => lines.push(`  ${si + 1}. ${s}`));
      }
      if (tc.expected_result) lines.push(`Expected: ${tc.expected_result}`);
      lines.push("");
      sections.push({ level: 2, title: `4.${i + 1}  ${tc.id} — ${tc.title}`, lines });
    });
  }

  // ── 5. Security Test Cases ────────────────────────────────────────────────
  if (data.security_test_cases?.test_cases?.length) {
    sections.push({ level: 1, title: "5. Security Test Cases", lines: [] });
    data.security_test_cases.test_cases.forEach((tc: any, i: number) => {
      const lines: string[] = [];
      if (tc.sr_id) lines.push(`Covers: ${tc.sr_id}    Severity: ${tc.severity}`);
      if (tc.attack_vector) lines.push(`Attack Vector: ${tc.attack_vector}`);
      if (tc.steps?.length) {
        lines.push("Steps:");
        tc.steps.forEach((s: string, si: number) => lines.push(`  ${si + 1}. ${s}`));
      }
      if (tc.expected_result) lines.push(`Expected: ${tc.expected_result}`);
      lines.push("");
      sections.push({ level: 2, title: `5.${i + 1}  ${tc.id} — ${tc.title}`, lines });
    });
  }

  // ── Appendix A: UML Diagrams ─────────────────────────────────────────────
  if (data.uml_diagrams?.diagrams?.length) {
    sections.push({ level: 1, title: "Appendix A: UML Diagrams", lines: [] });
    data.uml_diagrams.diagrams.forEach((d: any, i: number) => {
      sections.push({
        level: 2,
        title: `A.${i + 1}  ${d.title}`,
        lines: [
          `Type: ${d.type}`,
          d.description ? `Description: ${d.description}` : "",
        ].filter(Boolean),
        diagramId: d.id, // triggers PNG embedding when diagramSvgs is provided
      });
    });
  }

  // ── Appendix B: Traceability Matrix ──────────────────────────────────────
  if (data.traceability_matrix) {
    const cov = data.traceability_matrix.coverage;
    const lines: string[] = [];
    if (cov) lines.push(`Coverage: ${cov.covered_frs}/${cov.total_frs} FRs · ${cov.total_tcs} TCs · ${cov.percentage}%`);
    lines.push("");
    (data.traceability_matrix.matrix ?? []).forEach((row: any) => {
      lines.push(`${row.fr_id}: ${row.fr_title}`);
      lines.push(`  Tests:    ${(row.test_cases ?? []).join(", ")}`);
      lines.push(`  Security: ${(row.security_reqs ?? []).join(", ")}`);
      lines.push("");
    });
    sections.push({ level: 1, title: "Appendix B: Traceability Matrix", lines });
  }

  return sections;
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export async function generatePDF(
  projectName: string,
  artifacts: any[],
  diagramSvgs?: Record<string, string>
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  const streamDone = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Cover
  doc.fontSize(22).font("Helvetica-Bold").fillColor("#0f172a").text("Software Requirements Specification", { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(16).font("Helvetica-Bold").fillColor("#1e293b").text(projectName, { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica").fillColor("#64748b").text("IEEE Std 830-1998", { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(9).fillColor("#94a3b8").text(`Generated ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`, { align: "center" });
  doc.fillColor("#000000");
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cbd5e1").stroke();
  doc.moveDown(2);

  const sections = ieeeSections(flattenArtifacts(artifacts));
  const INDENT = [0, 0, 15, 30];

  for (const { title, level, lines, diagramId } of sections) {
    if (doc.y > 680) doc.addPage();

    const fontSize = level === 1 ? 13 : level === 2 ? 11 : 10;
    const indent = INDENT[level];

    if (level === 1) {
      doc.moveDown(0.6);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e2e8f0").stroke();
      doc.moveDown(0.4);
    }

    doc.fontSize(fontSize).font("Helvetica-Bold")
      .fillColor(level === 1 ? "#0f172a" : level === 2 ? "#1e293b" : "#334155")
      .text(title, { indent });
    doc.moveDown(0.3);

    // Embed diagram PNG when SVG data is available
    if (diagramId && diagramSvgs?.[diagramId]) {
      // print description lines first (type / description)
      for (const line of lines) {
        if (line.trim() === "") continue;
        doc.fontSize(9).font("Helvetica").fillColor("#64748b").text(line, { indent: indent + 5 });
      }
      doc.moveDown(0.4);
      try {
        const png = await svgToPng(diagramSvgs[diagramId]);
        if (doc.y > 500) doc.addPage();
        doc.image(png, { fit: [495, 340], align: "center" });
      } catch {
        doc.fontSize(9).font("Helvetica").fillColor("#ef4444").text("[Diagram rendering failed]", { indent });
      }
      doc.moveDown(1);
      continue;
    }

    // Regular text lines
    for (const line of lines) {
      if (doc.y > 730) doc.addPage();
      if (line.trim() === "") { doc.moveDown(0.3); continue; }
      const isBullet = line.startsWith("  ");
      doc.fontSize(9).font("Helvetica").fillColor("#334155")
        .text(line, { indent: indent + (isBullet ? 15 : 0) });
    }
    doc.moveDown(level === 1 ? 0.6 : 0.4);
  }

  doc.end();
  return streamDone;
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

export async function generateDOCX(
  projectName: string,
  artifacts: any[]
): Promise<Buffer> {
  const children: any[] = [
    new Paragraph({
      children: [
        new TextRun({ text: "Software Requirements Specification", bold: true, size: 36, color: "0f172a" }),
      ],
      alignment: "center" as any,
    }),
    new Paragraph({
      children: [new TextRun({ text: projectName, bold: true, size: 28, color: "1e293b" })],
      alignment: "center" as any,
    }),
    new Paragraph({
      children: [new TextRun({ text: "IEEE Std 830-1998", size: 20, color: "64748b" })],
      alignment: "center" as any,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated ${new Date().toLocaleDateString()}`, size: 18, color: "94a3b8" })],
      alignment: "center" as any,
    }),
    new Paragraph({ text: "" }),
  ];

  const sections = ieeeSections(flattenArtifacts(artifacts));
  const headingLevel = [
    undefined,
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
  ] as const;

  sections.forEach(({ title, level, lines }) => {
    children.push(new Paragraph({ text: title, heading: headingLevel[level] }));

    lines.forEach((line) => {
      if (line.trim() === "") {
        children.push(new Paragraph({ text: "" }));
        return;
      }
      const isBullet = line.startsWith("  ");
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 18, color: "334155" })],
          indent: isBullet ? { left: 720 } : undefined,
        }),
      );
    });
    children.push(new Paragraph({ text: "" }));
  });

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc);
}

// ─── LaTeX ───────────────────────────────────────────────────────────────────

function latexEsc(s: string): string {
  return String(s ?? "")
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

export function generateLaTeX(projectName: string, artifacts: any[]): string {
  const data = flattenArtifacts(artifacts);
  const sections = ieeeSections(data);
  const date = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });

  const lines: string[] = [
    "\\documentclass[12pt,a4paper]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{lmodern}",
    "\\usepackage[margin=2.5cm]{geometry}",
    "\\usepackage{hyperref}",
    "\\usepackage{enumitem}",
    "\\usepackage{booktabs}",
    "\\usepackage{xcolor}",
    "\\usepackage{titlesec}",
    "\\usepackage{parskip}",
    "",
    "\\hypersetup{colorlinks=true,linkcolor=blue,urlcolor=blue}",
    "\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]",
    "\\titleformat{\\subsection}{\\normalsize\\bfseries}{}{0em}{}",
    "\\titleformat{\\subsubsection}{\\normalsize\\itshape}{}{0em}{}",
    "",
    `\\title{\\textbf{Software Requirements Specification}\\\\[0.4em]\\large ${latexEsc(projectName)}}`,
    `\\author{IEEE Std 830-1998}`,
    `\\date{${latexEsc(date)}}`,
    "",
    "\\begin{document}",
    "\\maketitle",
    "\\tableofcontents",
    "\\newpage",
    "",
  ];

  for (const { title, level, lines: bodyLines } of sections) {
    const cmd = level === 1 ? "\\section*" : level === 2 ? "\\subsection*" : "\\subsubsection*";
    lines.push(`${cmd}{${latexEsc(title)}}`);

    for (const line of bodyLines) {
      if (line.trim() === "") {
        lines.push("");
        continue;
      }
      if (line.startsWith("  →") || line.startsWith("  ✓")) {
        // Start a bullet list for consecutive control/criteria lines
        lines.push("\\begin{itemize}[leftmargin=1.5em]");
        lines.push(`  \\item ${latexEsc(line.trim().replace(/^[→✓]\s*/, ""))}`);
        // peek ahead — handled by flushing below
        lines.push("\\end{itemize}");
      } else if (line.match(/^\s+\d+\.\s/)) {
        // Numbered step
        lines.push("\\begin{enumerate}[leftmargin=1.5em]");
        lines.push(`  \\item ${latexEsc(line.trim().replace(/^\d+\.\s*/, ""))}`);
        lines.push("\\end{enumerate}");
      } else {
        lines.push(latexEsc(line));
      }
    }
    lines.push("");
  }

  lines.push("\\end{document}");
  return lines.join("\n");
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
