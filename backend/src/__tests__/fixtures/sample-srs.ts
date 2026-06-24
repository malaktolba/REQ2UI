/**
 * A realistic, well-formed generated SRS — the artifact map the pipeline would
 * persist for a small e-learning platform. Used as the "golden" input for the
 * metrics-engine tests and as a reference shape elsewhere. It is built to pass
 * every rubric in metrics.service so degraded copies can be derived from it.
 */
import type { ArtifactMap } from "../../services/metrics.service";

const FR = (n: number, title: string): any => ({
  id: `FR-${String(n).padStart(3, "0")}`,
  title,
  priority: "High",
  description: `The system shall ${title.toLowerCase()}.`,
  acceptance_criteria: [`${title} succeeds for valid input`, `${title} is rejected for invalid input`],
});

const functionalRequirements = {
  requirements: [
    FR(1, "Register a new user account"),
    FR(2, "Authenticate a returning user"),
    FR(3, "Allow a teacher to create a course"),
    FR(4, "Allow a student to enrol in a course"),
    FR(5, "Display a student's enrolled courses"),
    FR(6, "Let a teacher upload course material"),
    FR(7, "Let a student submit an assignment"),
    FR(8, "Let a teacher grade a submission"),
    FR(9, "Notify a student when a grade is posted"),
    FR(10, "Allow an admin to deactivate an account"),
    FR(11, "Allow a user to reset a forgotten password"),
  ],
};

const NFR = (n: number, category: string, title: string, metric: string): any => ({
  id: `NFR-${String(n).padStart(3, "0")}`,
  category,
  title,
  description: `The system shall ${title.toLowerCase()}.`,
  metric,
});

const nonFunctionalRequirements = {
  requirements: [
    NFR(1, "Performance", "respond to requests promptly", "95% of requests under 2s"),
    NFR(2, "Reliability", "remain highly available", "99.9% monthly uptime"),
    NFR(3, "Security", "protect data in transit", "TLS 1.2+ on all endpoints"),
    NFR(4, "Usability", "be usable on first contact", "SUS score ≥ 80"),
    NFR(5, "Scalability", "scale to concurrent users", "5,000 concurrent sessions"),
    NFR(6, "Maintainability", "be maintainable", "≥ 70% unit-test coverage"),
    NFR(7, "Portability", "run across browsers", "latest 2 versions of major browsers"),
    NFR(8, "Performance", "load pages quickly", "First Contentful Paint < 1.5s"),
  ],
};

const SR = (n: number, owasp: string, title: string): any => ({
  id: `SR-${String(n).padStart(3, "0")}`,
  owasp_category: owasp,
  title,
  description: `The system shall ${title.toLowerCase()}.`,
  priority: "High",
  controls: [`Implement ${title.toLowerCase()}`, "Log and monitor related events"],
});

const securityRequirements = {
  requirements: [
    SR(1, "A01:2021 – Broken Access Control", "enforce role-based access control"),
    SR(2, "A02:2021 – Cryptographic Failures", "hash passwords with bcrypt"),
    SR(3, "A03:2021 – Injection", "use parameterised database queries"),
    SR(4, "A04:2021 – Insecure Design", "apply rate limiting to auth endpoints"),
    SR(5, "A05:2021 – Security Misconfiguration", "set secure HTTP headers"),
    SR(6, "A07:2021 – Identification and Authentication Failures", "lock accounts after repeated failures"),
    SR(7, "A08:2021 – Software and Data Integrity Failures", "validate token integrity"),
    SR(8, "A09:2021 – Security Logging and Monitoring Failures", "audit security-relevant events"),
  ],
};

// Two functional test cases per FR (positive + negative).
const functionalTestCases = {
  test_cases: functionalRequirements.requirements.flatMap((r, i) => [
    {
      id: `TC-${String(i * 2 + 1).padStart(3, "0")}`,
      fr_id: r.id,
      title: `${r.title} — valid path`,
      preconditions: "User is on the relevant screen",
      steps: ["Open the screen", "Enter valid input", "Submit"],
      expected_result: "The action completes successfully",
      priority: "High",
    },
    {
      id: `TC-${String(i * 2 + 2).padStart(3, "0")}`,
      fr_id: r.id,
      title: `${r.title} — invalid path`,
      preconditions: "User is on the relevant screen",
      steps: ["Open the screen", "Enter invalid input", "Submit"],
      expected_result: "A validation error is shown",
      priority: "Medium",
    },
  ]),
};

const securityTestCases = {
  test_cases: securityRequirements.requirements.map((r, i) => ({
    id: `STC-${String(i + 1).padStart(3, "0")}`,
    sr_id: r.id,
    title: `Verify ${r.title}`,
    attack_vector: "Attempt to bypass the control",
    steps: ["Craft a malicious request", "Send it to the endpoint"],
    expected_result: "The request is rejected and logged",
    severity: "High",
  })),
};

const wireframes = {
  screens: [
    { id: "SCR-001", name: "Login", route: "/login", description: "Authenticate users",
      components: [{ type: "form", label: "Sign in", purpose: "submit credentials" }], navigation: ["→ dashboard on success"] },
    { id: "SCR-002", name: "Dashboard", route: "/dashboard", description: "Overview of courses",
      components: [{ type: "card grid", label: "Courses", purpose: "list enrolled courses" }], navigation: ["→ course on click"] },
    { id: "SCR-003", name: "Course", route: "/course", description: "Course detail and materials",
      components: [{ type: "list", label: "Materials", purpose: "show uploads" }], navigation: ["→ submit assignment"] },
  ],
};

const traceabilityMatrix = {
  matrix: functionalRequirements.requirements.map((r, i) => ({
    fr_id: r.id,
    fr_title: r.title,
    test_cases: [`TC-${String(i * 2 + 1).padStart(3, "0")}`, `TC-${String(i * 2 + 2).padStart(3, "0")}`],
    security_reqs: i < securityRequirements.requirements.length ? [securityRequirements.requirements[i].id] : [],
  })),
  coverage: { total_frs: 11, covered_frs: 11, total_tcs: 22, percentage: 100 },
};

const umlDiagrams = {
  diagrams: [
    { id: "UML-001", title: "System Use Case Diagram", type: "use_case", description: "Primary use cases",
      mermaid: "flowchart TD\n  Student((Student))\n  UC1[Enrol in course]\n  Student --> UC1" },
    { id: "UML-002", title: "Domain Class Diagram", type: "class", description: "Core entities",
      mermaid: "classDiagram\n  class User {\n    +id String\n    +login()\n  }\n  User --> Course : enrols" },
    { id: "UML-003", title: "Main Sequence Diagram", type: "sequence", description: "Login flow",
      mermaid: "sequenceDiagram\n  actor User\n  participant System\n  User->>System: login\n  System-->>User: token" },
  ],
};

const html = (title: string) =>
  `<!DOCTYPE html><html><head><title>${title}</title></head><body><nav>Nav</nav><main>${title}</main><footer>©</footer></body></html>`;

const uiCode = {
  design_system: { navbar: "<nav>...</nav>", footer: "<footer>...</footer>", body_classes: "bg-slate-950" },
  screens: [
    { id: "SCR-001", name: "Login", route: "/login", description: "Auth", html: html("Login") },
    { id: "SCR-002", name: "Dashboard", route: "/dashboard", description: "Overview", html: html("Dashboard") },
  ],
};

export const SAMPLE_SRS: ArtifactMap = {
  extraction: {
    system_summary: "An e-learning platform connecting students and teachers around online courses.",
    abstract: "This document specifies an e-learning platform that enables teachers to publish courses and students to enrol, submit assignments, and receive grades. ".repeat(2),
    motivation: "Demand for flexible online education has grown sharply, yet many institutions lack a unified platform.",
    problem_statement: "Students and teachers lack a single system to manage courses, materials, submissions, and grading.",
    scope: "The platform covers registration, course management, enrolment, submissions, and grading; payment processing is out of scope.",
    objectives: ["Enable course publishing", "Enable enrolment", "Support assignment submission", "Support grading"],
    product_perspective: "The platform is a standalone web application that integrates with email for notifications.",
    assumptions: ["Users have internet access", "Users have a modern browser", "Email delivery is available"],
    constraints: ["Must run in a browser", "Must comply with data-protection law", "Must be responsive"],
    actors: ["Student", "Teacher", "Admin"],
    extracted: [
      "Users register with email and password", "Teachers create courses", "Students enrol in courses",
      "Teachers upload materials", "Students submit assignments", "Teachers grade submissions",
      "Students receive grade notifications", "Admins deactivate accounts", "Users reset forgotten passwords",
      "Students view enrolled courses", "Teachers view a class roster",
    ],
  },
  functional_requirements: functionalRequirements,
  non_functional_requirements: nonFunctionalRequirements,
  security_requirements: securityRequirements,
  functional_test_cases: functionalTestCases,
  security_test_cases: securityTestCases,
  wireframes,
  traceability_matrix: traceabilityMatrix,
  uml_diagrams: umlDiagrams,
  ui_code: uiCode,
};
