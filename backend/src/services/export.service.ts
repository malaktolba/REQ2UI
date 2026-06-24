import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { PassThrough } from "stream";
import { Resvg } from "@resvg/resvg-js";

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

  const ov = data.extraction ?? {};

  // ── Abstract (front matter) ───────────────────────────────────────────────
  if (ov.abstract) {
    sections.push({ level: 1, title: "Abstract", lines: [ov.abstract] });
  }

  // ── 1. Introduction ───────────────────────────────────────────────────────
  sections.push({ level: 1, title: "1. Introduction", lines: [] });
  let n1 = 0;
  sections.push({
    level: 2, title: `1.${++n1} Purpose`, lines: [
      "This Software Requirements Specification (SRS) describes the functional and " +
      "non-functional requirements for the system. It is prepared in accordance with " +
      "IEEE Std 830-1998 and serves as the authoritative reference for system design, development, and testing.",
    ],
  });
  if (ov.motivation) sections.push({ level: 2, title: `1.${++n1} Motivation`, lines: [ov.motivation] });
  if (ov.problem_statement) sections.push({ level: 2, title: `1.${++n1} Problem Statement`, lines: [ov.problem_statement] });
  sections.push({ level: 2, title: `1.${++n1} Scope`, lines: [ov.scope ?? ov.system_summary ?? "—"] });
  if (ov.objectives?.length) {
    sections.push({ level: 2, title: `1.${++n1} Objectives`, lines: ov.objectives.map((o: string, i: number) => `${i + 1}. ${o}`) });
  }
  if (ov.actors?.length) {
    sections.push({ level: 2, title: `1.${++n1} Intended Users`, lines: [ov.actors.join(", ")] });
  }
  sections.push({
    level: 2, title: `1.${++n1} Document Conventions`, lines: [
      "Requirements prefixed FR- are functional. NFR- are non-functional. " +
      "SR- are security requirements mapped to OWASP Top 10 (2021).",
    ],
  });

  // ── 2. Overall Description ────────────────────────────────────────────────
  sections.push({ level: 1, title: "2. Overall Description", lines: [] });
  let n2 = 0;
  sections.push({ level: 2, title: `2.${++n2} Product Perspective`, lines: [ov.product_perspective ?? ov.system_summary ?? "—"] });
  if (ov.actors?.length) {
    sections.push({ level: 2, title: `2.${++n2} User Characteristics`, lines: [ov.actors.join(", ")] });
  }
  if (ov.assumptions?.length) {
    sections.push({ level: 2, title: `2.${++n2} Assumptions`, lines: ov.assumptions.map((a: string) => `  ${a}`) });
  }
  if (ov.constraints?.length) {
    sections.push({ level: 2, title: `2.${++n2} Constraints`, lines: ov.constraints.map((c: string) => `  ${c}`) });
  }
  if (ov.extracted?.length) {
    sections.push({
      level: 2, title: `2.${++n2} Identified System Needs`,
      lines: ov.extracted.map((r: string, i: number) => `${i + 1}. ${r}`),
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

  // ── Appendix A: Generated UI Screens ─────────────────────────────────────
  if (data.ui_code?.screens?.length) {
    sections.push({ level: 1, title: "Appendix A: Generated UI Screens", lines: [] });
    data.ui_code.screens.forEach((sc: any, i: number) => {
      const lines: string[] = [];
      if (sc.route) lines.push(`Route: ${sc.route}`);
      if (sc.description) lines.push(sc.description);
      lines.push("Generated as standalone HTML + Tailwind CSS page.");
      sections.push({ level: 2, title: `A.${i + 1}  ${sc.id} — ${sc.name}`, lines });
    });
  }

  // ── Appendix B: UML Diagrams ─────────────────────────────────────────────
  if (data.uml_diagrams?.diagrams?.length) {
    sections.push({ level: 1, title: "Appendix B: UML Diagrams", lines: [] });
    data.uml_diagrams.diagrams.forEach((d: any, i: number) => {
      sections.push({
        level: 2,
        title: `B.${i + 1}  ${d.title}`,
        lines: [
          `Type: ${d.type}`,
          d.description ? `Description: ${d.description}` : "",
        ].filter(Boolean),
        diagramId: d.id, // triggers PNG embedding when diagramSvgs is provided
      });
    });
  }

  // ── Appendix C: Traceability Matrix ──────────────────────────────────────
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
    sections.push({ level: 1, title: "Appendix C: Traceability Matrix", lines });
  }

  return sections;
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

// Thesis palette (shared with the LaTeX export).
const NAVY = "#1A3A52";
const BLUE = "#2563EB";
const GREY = "#5D6B78";
const ROWGREY = "#F4F6F9";
const TEXT = "#243042";
const LIGHT = "#94A3B8";
const RULE = "#E5E7EB";

export async function generatePDF(
  projectName: string,
  artifacts: any[],
  diagramSvgs?: Record<string, string>,
  meta?: ExportMeta
): Promise<Buffer> {
  const data = flattenArtifacts(artifacts);
  const ov = data.extraction ?? {};
  const date = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  const streamDone = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const LEFT = 50;
  const RIGHT = 545;
  const WIDTH = RIGHT - LEFT; // 495
  const BOTTOM = doc.page.height - 64;
  let pageNo = 1; // title page

  // Running header + footer, drawn on every page added after the title page.
  // lineBreak:false + the re-entry guard keep the bottom-of-page footer text
  // from triggering pdfkit's auto-pagination (which would recurse via pageAdded).
  let decorating = false;
  const decorate = () => {
    if (decorating) return;
    decorating = true;
    pageNo++;
    doc.save();
    doc.font("Helvetica").fontSize(8).fillColor(GREY)
      .text(`${projectName}  —  Software Requirements Specification`, LEFT, 28, { width: WIDTH, align: "right", lineBreak: false });
    doc.strokeColor(RULE).lineWidth(0.5).moveTo(LEFT, 42).lineTo(RIGHT, 42).stroke();
    doc.fillColor(GREY).fontSize(8).text(`Page ${pageNo}`, LEFT, doc.page.height - 40, { width: WIDTH, align: "center", lineBreak: false });
    doc.restore();
    doc.x = LEFT;
    doc.y = 58;
    decorating = false;
  };

  // ── Heading / text helpers ──────────────────────────────────────────────────
  let chapterNo = 0;
  const heading = (title: string, numbered: boolean) => {
    if (doc.y > BOTTOM - 96) doc.addPage();
    else doc.moveDown(1);
    if (numbered) {
      chapterNo++;
      doc.font("Helvetica").fontSize(9).fillColor(GREY).text(`CHAPTER ${chapterNo}`, LEFT, doc.y, { characterSpacing: 1.5 });
      doc.moveDown(0.15);
    }
    doc.font("Helvetica-Bold").fontSize(numbered ? 20 : 18).fillColor(NAVY).text(title, LEFT, doc.y, { width: WIDTH });
    doc.moveDown(0.2);
    doc.strokeColor(NAVY).lineWidth(1.5).moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).stroke();
    doc.moveDown(0.7);
  };
  const chapter = (t: string) => heading(t, true);
  const front = (t: string) => heading(t, false);

  const section = (title: string) => {
    if (doc.y > BOTTOM - 48) doc.addPage();
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(NAVY).text(title, LEFT, doc.y, { width: WIDTH });
    doc.moveDown(0.3);
  };
  const para = (t?: string) => {
    if (!t) return;
    doc.font("Helvetica").fontSize(10).fillColor(TEXT).text(t, LEFT, doc.y, { width: WIDTH, align: "justify" });
    doc.moveDown(0.45);
  };
  const list = (items: string[], ordered: boolean) => {
    items.forEach((it, i) => {
      if (doc.y > BOTTOM) doc.addPage();
      const marker = ordered ? `${i + 1}.` : "•";
      const y = doc.y;
      doc.font("Helvetica").fontSize(10).fillColor(ordered ? GREY : BLUE).text(marker, LEFT + 6, y, { width: 18 });
      doc.font("Helvetica").fontSize(10).fillColor(TEXT).text(it, LEFT + 28, y, { width: WIDTH - 28 });
      doc.moveDown(0.2);
    });
    doc.moveDown(0.3);
  };

  // ── Navy-headed table ───────────────────────────────────────────────────────
  const table = (headers: string[], widths: number[], rows: string[][]) => {
    const PADX = 6;
    const PADY = 5;
    const drawHeader = () => {
      const h = 22;
      if (doc.y + h > BOTTOM) doc.addPage();
      doc.save();
      doc.rect(LEFT, doc.y, WIDTH, h).fill(NAVY);
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
      let x = LEFT;
      headers.forEach((htxt, ci) => {
        doc.text(htxt, x + PADX, doc.y + PADY + 1, { width: widths[ci] - 2 * PADX });
        x += widths[ci];
      });
      doc.restore();
      doc.y += h;
    };
    drawHeader();
    rows.forEach((row, ri) => {
      doc.font("Helvetica").fontSize(9).fillColor(TEXT);
      let rowH = 0;
      row.forEach((c, ci) => {
        const hh = doc.heightOfString(c || "", { width: widths[ci] - 2 * PADX });
        if (hh > rowH) rowH = hh;
      });
      rowH += 2 * PADY;
      if (doc.y + rowH > BOTTOM) { doc.addPage(); drawHeader(); doc.font("Helvetica").fontSize(9).fillColor(TEXT); }
      const yTop = doc.y;
      if (ri % 2 === 1) { doc.save(); doc.rect(LEFT, yTop, WIDTH, rowH).fill(ROWGREY); doc.restore(); }
      doc.fillColor(TEXT).font("Helvetica").fontSize(9);
      let x = LEFT;
      row.forEach((c, ci) => {
        doc.text(c || "", x + PADX, yTop + PADY, { width: widths[ci] - 2 * PADX });
        x += widths[ci];
      });
      doc.strokeColor(RULE).lineWidth(0.5).moveTo(LEFT, yTop + rowH).lineTo(RIGHT, yTop + rowH).stroke();
      doc.y = yTop + rowH;
    });
    doc.moveDown(0.7);
  };

  // ── Title page ──────────────────────────────────────────────────────────────
  doc.y = 200;
  doc.font("Helvetica-Bold").fontSize(13).fillColor(NAVY).text("SOFTWARE REQUIREMENTS SPECIFICATION", LEFT, doc.y, { width: WIDTH, align: "center", characterSpacing: 1 });
  doc.moveDown(1);
  doc.strokeColor(NAVY).lineWidth(1).moveTo(LEFT + 70, doc.y).lineTo(RIGHT - 70, doc.y).stroke();
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(30).fillColor(NAVY).text(projectName, LEFT, doc.y, { width: WIDTH, align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica-Oblique").fontSize(13).fillColor(BLUE).text("Functional, Non-Functional & Security Requirements", LEFT, doc.y, { width: WIDTH, align: "center" });
  doc.moveDown(0.8);
  doc.strokeColor(NAVY).lineWidth(1).moveTo(LEFT + 70, doc.y).lineTo(RIGHT - 70, doc.y).stroke();
  doc.moveDown(2.2);
  doc.font("Helvetica").fontSize(11).fillColor(TEXT).text("A Software Requirements Specification prepared in accordance with IEEE Std 830-1998.", LEFT, doc.y, { width: WIDTH, align: "center" });
  doc.moveDown(1.5);
  doc.fontSize(10).fillColor(GREY).text(`Generated ${date}`, LEFT, doc.y, { width: WIDTH, align: "center" });

  // Document-control block (organization, author, contact, version) — only the
  // fields that were supplied are shown, each on its own centered line.
  const mrows = metaRows(meta);
  if (mrows.length) {
    doc.moveDown(1.5);
    mrows.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text(`${label}:  `, { continued: true, align: "center" })
        .font("Helvetica").fillColor(TEXT).text(value);
    });
  }

  doc.font("Helvetica").fontSize(9).fillColor(LIGHT).text("Auto-generated by Req2UI", LEFT, doc.page.height - 96, { width: WIDTH, align: "center" });

  // Begin decorated content pages.
  doc.on("pageAdded", decorate);
  doc.addPage();

  // ── Front matter ────────────────────────────────────────────────────────────
  front("Declaration of Originality");
  para(`This Software Requirements Specification for "${projectName}" documents the functional, non-functional, and security requirements of the system. It was produced from a structured requirements-analysis pipeline and is intended to serve as the authoritative reference for the system's design, implementation, and testing. All requirements are derived from the supplied project description and are organised following the IEEE 830 recommended practice.`);

  if (ov.abstract) { front("Abstract"); para(ov.abstract); }

  front("Abbreviations");
  const abbreviations: [string, string][] = [
    ["SRS", "Software Requirements Specification."],
    ["FR", "Functional Requirement."],
    ["NFR", "Non-Functional Requirement."],
    ["SR", "Security Requirement (mapped to the OWASP Top 10, 2021)."],
    ["TC", "Functional Test Case (IEEE 829)."],
    ["STC", "Security Test Case."],
    ["OWASP", "Open Worldwide Application Security Project."],
    ["UML", "Unified Modeling Language."],
  ];
  abbreviations.forEach(([label, def]) => {
    if (doc.y > BOTTOM) doc.addPage();
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY).text(label, LEFT, y, { width: 70 });
    doc.font("Helvetica").fontSize(9).fillColor(TEXT).text(def, LEFT + 80, y, { width: WIDTH - 80 });
    doc.moveDown(0.3);
  });

  // ── Chapter 1: Introduction ─────────────────────────────────────────────────
  chapter("Introduction");
  section("Purpose");
  para(`This document specifies the requirements for ${projectName}. It is prepared in accordance with IEEE Std 830-1998 and serves as the authoritative reference for the design, development, and testing of the system. Requirements prefixed FR- are functional, NFR- non-functional, and SR- security requirements mapped to the OWASP Top 10 (2021).`);
  if (ov.motivation) { section("Motivation"); para(ov.motivation); }
  if (ov.problem_statement) { section("Problem Statement"); para(ov.problem_statement); }
  section("Scope");
  para(ov.scope ?? ov.system_summary ?? "—");
  if (ov.objectives?.length) { section("Objectives"); list(ov.objectives, true); }
  if (ov.actors?.length) { section("Intended Users"); list(ov.actors, false); }

  // ── Chapter 2: Overall Description ──────────────────────────────────────────
  chapter("Overall Description");
  section("Product Perspective");
  para(ov.product_perspective ?? ov.system_summary ?? "—");
  if (ov.actors?.length) { section("User Characteristics"); list(ov.actors, false); }
  if (ov.assumptions?.length) { section("Assumptions"); list(ov.assumptions, false); }
  if (ov.constraints?.length) { section("Constraints"); list(ov.constraints, false); }
  if (ov.extracted?.length) { section("Identified System Needs"); list(ov.extracted, true); }

  // ── Chapter 3: Specific Requirements ────────────────────────────────────────
  const frs = data.functional_requirements?.requirements ?? [];
  const nfrs = data.non_functional_requirements?.requirements ?? [];
  const srs = data.security_requirements?.requirements ?? [];
  if (frs.length || nfrs.length || srs.length) {
    chapter("Specific Requirements");
    if (frs.length) {
      section("Functional Requirements (IEEE 830)");
      table(["ID", "Priority", "Requirement"], [70, 70, 355], frs.map((r: any) => {
        let cell = r.title ? `${r.title}\n` : "";
        cell += r.description ?? "";
        if (r.acceptance_criteria?.length) cell += `\nAcceptance: ${r.acceptance_criteria.join("; ")}`;
        return [r.id ?? "", r.priority ?? "", cell];
      }));
    }
    if (nfrs.length) {
      section("Non-Functional Requirements");
      table(["ID", "Category", "Requirement"], [70, 110, 315], nfrs.map((r: any) => {
        let cell = r.title ? `${r.title}\n` : "";
        cell += r.description ?? "";
        if (r.metric) cell += `\nMetric: ${r.metric}`;
        return [r.id ?? "", r.category ?? "", cell];
      }));
    }
    if (srs.length) {
      section("Security Requirements (OWASP Top 10)");
      table(["ID", "OWASP Category", "Requirement"], [65, 120, 310], srs.map((r: any) => {
        let cell = r.title ? `${r.title}\n` : "";
        cell += r.description ?? "";
        if (r.priority) cell += `\nPriority: ${r.priority}`;
        if (r.controls?.length) cell += `\nControls: ${r.controls.join("; ")}`;
        return [r.id ?? "", r.owasp_category ?? "", cell];
      }));
    }
  }

  // ── Chapter 4: Functional Test Cases ────────────────────────────────────────
  const tcs = data.functional_test_cases?.test_cases ?? [];
  if (tcs.length) {
    chapter("Functional Test Cases (IEEE 829)");
    table(["ID", "Covers", "Steps", "Expected Result"], [65, 90, 175, 165], tcs.map((tc: any) => {
      let steps = (tc.steps ?? []).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n");
      if (tc.preconditions) steps = `Pre: ${tc.preconditions}\n${steps}`;
      const covers = [tc.fr_id ?? "", tc.priority ? `(${tc.priority})` : ""].filter(Boolean).join(" ");
      return [tc.id ?? "", covers, steps, tc.expected_result ?? ""];
    }));
  }

  // ── Chapter 5: Security Test Cases ──────────────────────────────────────────
  const stcs = data.security_test_cases?.test_cases ?? [];
  if (stcs.length) {
    chapter("Security Test Cases");
    table(["ID", "Covers", "Attack Vector & Steps", "Expected Result"], [65, 90, 175, 165], stcs.map((tc: any) => {
      const steps = (tc.steps ?? []).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n");
      let attack = tc.attack_vector ?? "";
      if (steps) attack += (attack ? "\n" : "") + steps;
      const covers = [tc.sr_id ?? "", tc.severity ? `(${tc.severity})` : ""].filter(Boolean).join(" ");
      return [tc.id ?? "", covers, attack, tc.expected_result ?? ""];
    }));
  }

  // ── Chapter 6: Traceability Matrix ──────────────────────────────────────────
  const tm = data.traceability_matrix;
  if (tm) {
    chapter("Traceability Matrix");
    if (tm.coverage) {
      const c = tm.coverage;
      para(`Requirement coverage: ${c.covered_frs ?? ""} of ${c.total_frs ?? ""} functional requirements traced across ${c.total_tcs ?? ""} test cases (${c.percentage ?? ""}%).`);
    }
    const rows = (tm.matrix ?? []).map((row: any) => [
      row.fr_id ?? "",
      row.fr_title ?? "",
      (row.test_cases ?? []).join(", "),
      (row.security_reqs ?? []).join(", "),
    ]);
    if (rows.length) table(["FR", "Title", "Test Cases", "Security"], [65, 170, 140, 120], rows);
  }

  // ── Chapter 7: UML Diagrams ─────────────────────────────────────────────────
  const diagrams = data.uml_diagrams?.diagrams ?? [];
  if (diagrams.length) {
    chapter("UML Diagrams");
    for (const d of diagrams) {
      section(d.title ?? "Diagram");
      if (d.description) para(d.description);
      if (diagramSvgs?.[d.id]) {
        try {
          const png = await svgToPng(diagramSvgs[d.id]);
          if (doc.y > BOTTOM - 200) doc.addPage();
          doc.image(png, LEFT, doc.y, { fit: [WIDTH, 340], align: "center" });
          doc.moveDown(1);
        } catch {
          doc.font("Helvetica-Oblique").fontSize(9).fillColor(GREY).text("[Diagram rendering unavailable]", LEFT, doc.y, { width: WIDTH });
          doc.moveDown(0.5);
        }
      } else {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor(GREY).text("Diagram available in the app (Mermaid).", LEFT, doc.y, { width: WIDTH });
        doc.moveDown(0.5);
      }
    }
  }

  // ── Appendix A: Generated UI Screens ────────────────────────────────────────
  const screens = data.ui_code?.screens ?? [];
  if (screens.length) {
    front("Appendix A — Generated UI Screens");
    para("The platform generated the following screens as standalone HTML + Tailwind CSS pages.");
    table(["Screen", "Route", "Description"], [90, 120, 285], screens.map((sc: any) => [
      sc.id ?? sc.name ?? "",
      sc.route ?? "",
      sc.description ?? "",
    ]));
  }

  doc.end();
  return streamDone;
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

export async function generateDOCX(
  projectName: string,
  artifacts: any[],
  meta?: ExportMeta
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
    // Document-control block: one centered line per supplied field.
    ...metaRows(meta).map(([label, value]) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 18, color: "475569" }),
          new TextRun({ text: value, size: 18, color: "475569" }),
        ],
        alignment: "center" as any,
      })
    ),
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
export function generateLaTeX(projectName: string, artifacts: any[], meta?: ExportMeta): string {
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
      L.push("The diagram is expressed in Mermaid syntax:", "", "\\begin{verbatim}");
      for (const ml of String(d.mermaid ?? "").split("\n")) L.push(ml);
      L.push("\\end{verbatim}", "");
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
