import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from "docx";
import { PassThrough } from "stream";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function flattenArtifacts(artifacts: any[]): Record<string, any> {
  return Object.fromEntries(artifacts.map((a: any) => [a.type, a.content]));
}

function artifactSections(data: Record<string, any>): Array<{ title: string; lines: string[] }> {
  const sections: Array<{ title: string; lines: string[] }> = [];

  if (data.extraction) {
    const lines: string[] = [];
    if (data.extraction.system_summary) lines.push(`Summary: ${data.extraction.system_summary}`);
    if (data.extraction.actors?.length) lines.push(`Actors: ${data.extraction.actors.join(", ")}`);
    (data.extraction.extracted ?? []).forEach((r: string, i: number) => lines.push(`${i + 1}. ${r}`));
    sections.push({ title: "1. Requirement Extraction", lines });
  }

  if (data.functional_requirements?.requirements) {
    const lines: string[] = [];
    data.functional_requirements.requirements.forEach((r: any) => {
      lines.push(`[${r.id}] ${r.title} (${r.priority})`);
      lines.push(`  ${r.description}`);
      (r.acceptance_criteria ?? []).forEach((c: string) => lines.push(`  ✓ ${c}`));
      lines.push("");
    });
    sections.push({ title: "2. Functional Requirements (IEEE 830)", lines });
  }

  if (data.non_functional_requirements?.requirements) {
    const lines: string[] = [];
    data.non_functional_requirements.requirements.forEach((r: any) => {
      lines.push(`[${r.id}] ${r.title} — ${r.category}`);
      lines.push(`  ${r.description}`);
      if (r.metric) lines.push(`  Metric: ${r.metric}`);
      lines.push("");
    });
    sections.push({ title: "3. Non-Functional Requirements", lines });
  }

  if (data.security_requirements?.requirements) {
    const lines: string[] = [];
    data.security_requirements.requirements.forEach((r: any) => {
      lines.push(`[${r.id}] ${r.title} (${r.priority})`);
      lines.push(`  OWASP: ${r.owasp_category}`);
      lines.push(`  ${r.description}`);
      (r.controls ?? []).forEach((c: string) => lines.push(`  → ${c}`));
      lines.push("");
    });
    sections.push({ title: "4. Security Requirements (OWASP Top 10)", lines });
  }

  if (data.functional_test_cases?.test_cases) {
    const lines: string[] = [];
    data.functional_test_cases.test_cases.forEach((tc: any) => {
      lines.push(`[${tc.id}] ${tc.title} (covers ${tc.fr_id}, ${tc.priority})`);
      if (tc.preconditions) lines.push(`  Pre: ${tc.preconditions}`);
      (tc.steps ?? []).forEach((s: string, i: number) => lines.push(`  ${i + 1}. ${s}`));
      lines.push(`  Expected: ${tc.expected_result}`);
      lines.push("");
    });
    sections.push({ title: "5. Functional Test Cases (IEEE 829)", lines });
  }

  if (data.security_test_cases?.test_cases) {
    const lines: string[] = [];
    data.security_test_cases.test_cases.forEach((tc: any) => {
      lines.push(`[${tc.id}] ${tc.title} (covers ${tc.sr_id}, ${tc.severity})`);
      if (tc.attack_vector) lines.push(`  Attack: ${tc.attack_vector}`);
      (tc.steps ?? []).forEach((s: string, i: number) => lines.push(`  ${i + 1}. ${s}`));
      lines.push(`  Expected: ${tc.expected_result}`);
      lines.push("");
    });
    sections.push({ title: "6. Security Test Cases", lines });
  }

  if (data.wireframes?.screens) {
    const lines: string[] = [];
    data.wireframes.screens.forEach((sc: any) => {
      lines.push(`[${sc.id}] ${sc.name} ${sc.route ? `(${sc.route})` : ""}`);
      lines.push(`  ${sc.description}`);
      (sc.components ?? []).forEach((c: any) => lines.push(`  [${c.type}] ${c.label}: ${c.purpose}`));
      (sc.navigation ?? []).forEach((n: string) => lines.push(`  ${n}`));
      lines.push("");
    });
    sections.push({ title: "7. UI Wireframe Descriptions", lines });
  }

  if (data.traceability_matrix) {
    const cov = data.traceability_matrix.coverage;
    const lines: string[] = [];
    if (cov) lines.push(`Coverage: ${cov.covered_frs}/${cov.total_frs} FRs, ${cov.total_tcs} TCs (${cov.percentage}%)`);
    lines.push("");
    (data.traceability_matrix.matrix ?? []).forEach((row: any) => {
      lines.push(`${row.fr_id}: ${row.fr_title}`);
      lines.push(`  Tests: ${(row.test_cases ?? []).join(", ")}`);
      lines.push(`  Security: ${(row.security_reqs ?? []).join(", ")}`);
    });
    sections.push({ title: "8. Traceability Matrix", lines });
  }

  return sections;
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export function generatePDF(
  projectName: string,
  artifacts: any[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Cover
    doc.fontSize(24).font("Helvetica-Bold").text("Req2UI", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(16).font("Helvetica").text(projectName, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#888").text(`Generated ${new Date().toLocaleDateString()}`, { align: "center" });
    doc.fillColor("#000");
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(2);

    const sections = artifactSections(flattenArtifacts(artifacts));

    sections.forEach(({ title, lines }) => {
      if (doc.y > 680) doc.addPage();
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#1e293b").text(title);
      doc.moveDown(0.4);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e2e8f0").stroke();
      doc.strokeColor("#000");
      doc.moveDown(0.4);

      lines.forEach((line) => {
        if (doc.y > 720) doc.addPage();
        const isHeader = /^\[/.test(line) && !line.startsWith("  ");
        doc
          .fontSize(isHeader ? 10 : 9)
          .font(isHeader ? "Helvetica-Bold" : "Helvetica")
          .fillColor(isHeader ? "#0f172a" : "#334155")
          .text(line || " ", { continued: false });
      });
      doc.moveDown(1.2);
    });

    doc.end();
  });
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

export async function generateDOCX(
  projectName: string,
  artifacts: any[]
): Promise<Buffer> {
  const children: any[] = [
    new Paragraph({
      text: "Req2UI — " + projectName,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated ${new Date().toLocaleDateString()}`, color: "888888", size: 18 })],
    }),
    new Paragraph({ text: "" }),
  ];

  const sections = artifactSections(flattenArtifacts(artifacts));

  sections.forEach(({ title, lines }) => {
    children.push(
      new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
    );
    lines.forEach((line) => {
      const isHeader = /^\[/.test(line) && !line.startsWith("  ");
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line || "",
              bold: isHeader,
              size: isHeader ? 20 : 18,
              color: isHeader ? "0f172a" : "334155",
            }),
          ],
          indent: line.startsWith("  ") ? { left: 360 } : undefined,
        }),
      );
    });
    children.push(new Paragraph({ text: "" }));
  });

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc);
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
