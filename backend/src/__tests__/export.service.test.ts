import { generateLaTeX, generateCSV } from "../services/export.service";

const SAMPLE_ARTIFACTS = [
  {
    type: "extraction",
    content: {
      system_summary: "An e-learning platform for students and teachers.",
      actors: ["Student", "Teacher", "Admin"],
      extracted: ["Users shall register with email", "Students can enroll in courses"],
    },
  },
  {
    type: "functional_requirements",
    content: {
      requirements: [
        {
          id: "FR-001",
          title: "User Registration",
          description: "The system shall allow users to register with email and password.",
          priority: "High",
          acceptance_criteria: ["Email must be unique", "Password minimum 8 characters"],
        },
        {
          id: "FR-002",
          title: "Course Enrollment",
          description: "Students shall be able to enroll in available courses.",
          priority: "Medium",
          acceptance_criteria: ["Student sees available courses", "Confirmation sent on enroll"],
        },
      ],
    },
  },
  {
    type: "non_functional_requirements",
    content: {
      requirements: [
        {
          id: "NFR-001",
          title: "Response Time",
          description: "The system shall respond within 2 seconds.",
          category: "Performance",
          metric: "2s for 95% of requests",
        },
        {
          id: "NFR-002",
          title: "Availability",
          description: "The system shall be available 99.9% of the time.",
          category: "Reliability",
          metric: "99.9% uptime",
        },
      ],
    },
  },
  {
    type: "security_requirements",
    content: {
      requirements: [
        {
          id: "SR-001",
          title: "Password Hashing",
          description: "The system shall hash all passwords using bcrypt.",
          priority: "Critical",
          owasp_category: "A02:2021 Cryptographic Failures",
          controls: ["Use bcrypt with cost factor 12", "Never store plaintext passwords"],
        },
      ],
    },
  },
];

// ─── LaTeX tests ─────────────────────────────────────────────────────────────

describe("generateLaTeX", () => {
  let latex: string;

  beforeAll(() => {
    latex = generateLaTeX("E-Learning Platform", SAMPLE_ARTIFACTS);
  });

  it("produces a thesis-style report document structure", () => {
    expect(latex).toContain("\\documentclass[11pt,a4paper]{report}");
    expect(latex).toContain("\\begin{document}");
    expect(latex).toContain("\\end{document}");
    expect(latex).toContain("\\tableofcontents");
    expect(latex).toContain("\\listoftables");
  });

  it("defines the thesis colour palette and styled headings", () => {
    expect(latex).toContain("\\definecolor{procastnavy}{HTML}{1A3A52}");
    expect(latex).toContain("\\titleformat{\\chapter}");
    expect(latex).toContain("\\pagestyle{fancy}");
  });

  it("includes a title page and front matter", () => {
    expect(latex).toContain("\\begin{titlepage}");
    expect(latex).toContain("\\chapter*{Declaration of Originality}");
    expect(latex).toContain("\\chapter*{Abstract}");
    expect(latex).toContain("\\chapter*{Abbreviations}");
  });

  it("includes the project name on the title page", () => {
    expect(latex).toContain("E-Learning Platform");
  });

  it("includes numbered chapters and requirement sections", () => {
    expect(latex).toContain("\\chapter{Introduction}");
    expect(latex).toContain("\\chapter{Specific Requirements}");
    expect(latex).toContain("\\section{Functional Requirements (IEEE 830)}");
    expect(latex).toContain("\\section{Non-Functional Requirements}");
    expect(latex).toContain("\\section{Security Requirements (OWASP Top 10)}");
  });

  it("renders requirements in colour-headed tables", () => {
    expect(latex).toContain("\\begin{xltabular}");
    expect(latex).toContain("\\rowcolor{procastnavy}");
    expect(latex).toContain("FR-001");
    expect(latex).toContain("User Registration");
    expect(latex).toContain("SR-001");
  });

  it("xltabular environments are balanced", () => {
    const starts = (latex.match(/\\begin\{xltabular\}/g) ?? []).length;
    const ends = (latex.match(/\\end\{xltabular\}/g) ?? []).length;
    expect(starts).toBe(ends);
    expect(starts).toBeGreaterThan(0);
  });

  it("itemize and enumerate environments are balanced", () => {
    expect((latex.match(/\\begin\{itemize\}/g) ?? []).length).toBe((latex.match(/\\end\{itemize\}/g) ?? []).length);
    expect((latex.match(/\\begin\{enumerate\}/g) ?? []).length).toBe((latex.match(/\\end\{enumerate\}/g) ?? []).length);
  });

  it("folds acceptance criteria and controls into requirement rows", () => {
    expect(latex).toContain("Email must be unique");
    expect(latex).toContain("Password minimum 8 characters");
    expect(latex).toContain("Use bcrypt with cost factor 12");
  });

  it("includes actors as intended users", () => {
    expect(latex).toContain("Student");
    expect(latex).toContain("Teacher");
  });
});

// ─── CSV tests ────────────────────────────────────────────────────────────────

/** Parse a simple RFC 4180-style CSV line where all fields are double-quoted */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let field = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { field += line[i++]; }
      }
      result.push(field);
      if (line[i] === ",") i++; // skip comma separator
    } else {
      const end = line.indexOf(",", i);
      result.push(end === -1 ? line.slice(i) : line.slice(i, end));
      i = end === -1 ? line.length : end + 1;
    }
  }
  return result;
}

describe("generateCSV", () => {
  let csv: string;
  let rows: string[][];

  beforeAll(() => {
    csv = generateCSV(SAMPLE_ARTIFACTS);
    rows = csv.split("\n").map(parseCSVLine);
  });

  it("starts with a header row", () => {
    expect(rows[0]).toEqual(["Section", "ID", "Title/Name", "Description/Content", "Extra"]);
  });

  it("includes functional requirement rows", () => {
    const fr = rows.find((r) => r[0] === "FR" && r[1] === "FR-001");
    expect(fr).toBeDefined();
    expect(fr![2]).toBe("User Registration");
    expect(fr![4]).toContain("High");
  });

  it("includes non-functional requirement rows", () => {
    const nfr = rows.find((r) => r[0] === "NFR" && r[1] === "NFR-001");
    expect(nfr).toBeDefined();
    expect(nfr![4]).toContain("Performance");
  });

  it("includes security requirement rows", () => {
    const sr = rows.find((r) => r[0] === "SR" && r[1] === "SR-001");
    expect(sr).toBeDefined();
    expect(sr![4]).toContain("OWASP");
  });

  it("produces the correct number of data rows", () => {
    // 1 header + 2 FRs + 2 NFRs + 1 SR = 6 rows
    expect(rows.length).toBe(6);
  });
});
