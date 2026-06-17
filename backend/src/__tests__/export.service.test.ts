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

/** Extract the body of a subsubsection (between its heading and the next heading) */
function extractSubsection(latex: string, sectionTitle: string): string {
  const start = latex.indexOf(sectionTitle);
  if (start === -1) return "";
  // Find next \subsection or \subsubsection or \section after this one
  const after = latex.indexOf("\\", start + sectionTitle.length + 10);
  const nextSection = latex.search(new RegExp("\\\\sub(sub)?section\\*|\\\\section\\*", ""));
  // Find next heading after current position
  const rest = latex.slice(start + sectionTitle.length);
  const nextHeading = rest.search(/\\(sub)?section\*/);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
}

// ─── LaTeX tests ─────────────────────────────────────────────────────────────

describe("generateLaTeX", () => {
  let latex: string;

  beforeAll(() => {
    latex = generateLaTeX("E-Learning Platform", SAMPLE_ARTIFACTS);
  });

  it("produces valid LaTeX document structure", () => {
    expect(latex).toContain("\\documentclass");
    expect(latex).toContain("\\begin{document}");
    expect(latex).toContain("\\end{document}");
    expect(latex).toContain("\\maketitle");
    expect(latex).toContain("\\tableofcontents");
  });

  it("includes project name in title", () => {
    expect(latex).toContain("E-Learning Platform");
  });

  it("includes IEEE section headings", () => {
    expect(latex).toContain("\\section*{1. Introduction}");
    expect(latex).toContain("\\section*{2. Overall Description}");
    expect(latex).toContain("\\section*{3. Specific Requirements}");
  });

  it("includes subsection headings for requirements", () => {
    expect(latex).toContain("3.1 Functional Requirements");
    expect(latex).toContain("3.2 Non-Functional Requirements");
    expect(latex).toContain("3.3 Security Requirements");
  });

  it("includes requirement IDs and titles", () => {
    expect(latex).toContain("FR-001");
    expect(latex).toContain("User Registration");
    expect(latex).toContain("SR-001");
  });

  it("itemize and enumerate environments are balanced", () => {
    const itemizeStarts = (latex.match(/\\begin\{itemize\}/g) ?? []).length;
    const itemizeEnds = (latex.match(/\\end\{itemize\}/g) ?? []).length;
    expect(itemizeStarts).toBe(itemizeEnds);
  });

  it("groups SR-001 controls into a single itemize block", () => {
    // SR-001 has 2 controls — they must share ONE \begin{itemize}
    const srStart = latex.indexOf("SR-001 — Password Hashing");
    expect(srStart).toBeGreaterThan(-1);
    const srSection = latex.slice(srStart);
    // Only one \begin{itemize} in the SR-001 subsubsection body
    const nextSubsec = srSection.indexOf("\\subsubsection*", 5);
    const sr001Body = nextSubsec === -1 ? srSection : srSection.slice(0, nextSubsec);
    const itemizeCount = (sr001Body.match(/\\begin\{itemize\}/g) ?? []).length;
    expect(itemizeCount).toBe(1);
    // Both controls must be \item entries
    expect(sr001Body).toContain("\\item Use bcrypt");
    expect(sr001Body).toContain("\\item Never store");
  });

  it("groups FR-001 acceptance criteria into a single itemize block", () => {
    const frStart = latex.indexOf("FR-001 — User Registration");
    expect(frStart).toBeGreaterThan(-1);
    const frSection = latex.slice(frStart);
    const nextSubsec = frSection.indexOf("\\subsubsection*", 5);
    const fr001Body = nextSubsec === -1 ? frSection : frSection.slice(0, nextSubsec);
    const itemizeCount = (fr001Body.match(/\\begin\{itemize\}/g) ?? []).length;
    expect(itemizeCount).toBe(1);
    expect(fr001Body).toContain("\\item Email must be unique");
    expect(fr001Body).toContain("\\item Password minimum 8");
  });

  it("includes actors", () => {
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
