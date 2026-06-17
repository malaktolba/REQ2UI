import { sql } from "../db/client";
import { callGroq } from "./groq.service";

export interface StageEvent {
  stage: number;
  name: string;
  status: "running" | "completed" | "failed";
  error?: string;
}

type Emit = (event: StageEvent) => void;

const STAGE_NAMES = [
  "Requirement Extraction",
  "Functional Requirements (IEEE 830)",
  "Non-Functional Requirements",
  "Security Requirements (OWASP)",
  "Functional Test Cases (IEEE 829)",
  "Security Test Cases",
  "UI Wireframe Descriptions",
  "Traceability Matrix",
  "UML Diagrams",
  "UI Code Generation",
];

async function upsertStage(
  projectId: string,
  stage: number,
  status: string,
  error?: string
) {
  const name = STAGE_NAMES[stage - 1];
  const startedAt = status === "running" ? new Date() : null;
  const finishedAt = status === "completed" || status === "failed" ? new Date() : null;

  await sql`
    INSERT INTO pipeline_stages (project_id, stage, name, status, error, started_at, finished_at)
    VALUES (${projectId}, ${stage}, ${name}, ${status}, ${error ?? null}, ${startedAt}, ${finishedAt})
    ON CONFLICT (project_id, stage) DO UPDATE SET
      status = EXCLUDED.status,
      error = EXCLUDED.error,
      started_at = COALESCE(pipeline_stages.started_at, EXCLUDED.started_at),
      finished_at = EXCLUDED.finished_at
  `;
}

async function upsertArtifact(projectId: string, type: string, content: any) {
  await sql`
    INSERT INTO artifacts (project_id, type, content)
    VALUES (${projectId}, ${type}, ${JSON.stringify(content)})
    ON CONFLICT (project_id, type) DO UPDATE SET
      content = EXCLUDED.content,
      version = artifacts.version + 1,
      updated_at = NOW()
  `;
}

async function runStage<T>(
  projectId: string,
  stageNum: number,
  artifactType: string,
  system: string,
  user: string,
  emit: Emit
): Promise<T> {
  const name = STAGE_NAMES[stageNum - 1];
  emit({ stage: stageNum, name, status: "running" });
  await upsertStage(projectId, stageNum, "running");

  try {
    const result = await callGroq(system, user);
    await upsertArtifact(projectId, artifactType, result);
    await upsertStage(projectId, stageNum, "completed");
    emit({ stage: stageNum, name, status: "completed" });
    return result as T;
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    await upsertStage(projectId, stageNum, "failed", msg);
    emit({ stage: stageNum, name, status: "failed", error: msg });
    throw err;
  }
}

export async function runPipeline(
  projectId: string,
  projectName: string,
  description: string,
  emit: Emit
): Promise<void> {
  await sql`UPDATE projects SET status = 'generating', updated_at = NOW() WHERE id = ${projectId}`;

  try {
    // ── Stage 1: Requirement Extraction ──────────────────────────────────────
    const s1 = await runStage<any>(
      projectId, 1, "extraction",
      `You are a senior software analyst. Extract all software requirements from the user's project description.
Return a JSON object with this exact shape:
{
  "system_summary": "2-3 sentence summary of the system",
  "actors": ["actor1", "actor2"],
  "extracted": ["clear requirement statement 1", "clear requirement statement 2", ...]
}
Extract at least 10 distinct requirements. Be specific and implementation-agnostic.`,
      `Project: ${projectName}\n\nDescription:\n${description}`,
      emit
    );

    // ── Stage 2: Functional Requirements (IEEE 830) ───────────────────────────
    const s2 = await runStage<any>(
      projectId, 2, "functional_requirements",
      `You are a software requirements engineer. Convert extracted requirements into formal IEEE 830 functional requirements.
Return a JSON object with this exact shape:
{
  "requirements": [
    {
      "id": "FR-001",
      "title": "short title",
      "priority": "High|Medium|Low",
      "description": "The system shall ...",
      "acceptance_criteria": ["criterion 1", "criterion 2"]
    }
  ]
}
Generate at least 10 functional requirements. Each must start with "The system shall".`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Actors: ${s1.actors?.join(", ")}
Extracted requirements:
${s1.extracted?.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}`,
      emit
    );

    // ── Stage 3: Non-Functional Requirements ─────────────────────────────────
    const s3 = await runStage<any>(
      projectId, 3, "non_functional_requirements",
      `You are a software architect. Generate non-functional requirements for the system.
Return a JSON object with this exact shape:
{
  "requirements": [
    {
      "id": "NFR-001",
      "category": "Performance|Security|Usability|Reliability|Scalability|Maintainability|Portability",
      "title": "short title",
      "description": "The system shall ...",
      "metric": "measurable acceptance metric"
    }
  ]
}
Generate at least 8 NFRs covering different quality attributes.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Functional requirements count: ${s2.requirements?.length}`,
      emit
    );

    // ── Stage 4: Security Requirements (OWASP) ───────────────────────────────
    const s4 = await runStage<any>(
      projectId, 4, "security_requirements",
      `You are a cybersecurity architect. Generate security requirements based on OWASP Top 10 2021.
Return a JSON object with this exact shape:
{
  "requirements": [
    {
      "id": "SR-001",
      "owasp_category": "A01:2021 – Broken Access Control",
      "title": "short title",
      "description": "The system shall ...",
      "priority": "Critical|High|Medium|Low",
      "controls": ["control measure 1", "control measure 2"]
    }
  ]
}
Map requirements to relevant OWASP categories. Generate at least 8 security requirements.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Actors: ${s1.actors?.join(", ")}
Key functional requirements:
${s2.requirements?.slice(0, 5).map((r: any) => `${r.id}: ${r.title}`).join("\n")}`,
      emit
    );

    // ── Stage 5: Functional Test Cases (IEEE 829) ────────────────────────────
    const s5 = await runStage<any>(
      projectId, 5, "functional_test_cases",
      `You are a QA engineer. Generate IEEE 829 functional test cases for the functional requirements.
Return a JSON object with this exact shape:
{
  "test_cases": [
    {
      "id": "TC-001",
      "fr_id": "FR-001",
      "title": "short test title",
      "preconditions": "system state before test",
      "steps": ["step 1", "step 2", "step 3"],
      "expected_result": "what should happen",
      "priority": "High|Medium|Low"
    }
  ]
}
Generate at least 2 test cases per functional requirement. Include positive and negative cases.`,
      `Project: ${projectName}
Functional requirements:
${s2.requirements?.map((r: any) => `${r.id}: ${r.title} — ${r.description}`).join("\n")}`,
      emit
    );

    // ── Stage 6: Security Test Cases ─────────────────────────────────────────
    const s6 = await runStage<any>(
      projectId, 6, "security_test_cases",
      `You are a penetration tester. Generate security test cases for the security requirements.
Return a JSON object with this exact shape:
{
  "test_cases": [
    {
      "id": "STC-001",
      "sr_id": "SR-001",
      "title": "short test title",
      "attack_vector": "describe the attack being tested",
      "steps": ["step 1", "step 2"],
      "expected_result": "expected secure behavior",
      "severity": "Critical|High|Medium|Low"
    }
  ]
}
Generate at least 1 test case per security requirement.`,
      `Project: ${projectName}
Security requirements:
${s4.requirements?.map((r: any) => `${r.id}: ${r.title} (${r.owasp_category})`).join("\n")}`,
      emit
    );

    // ── Stage 7: UI Wireframe Descriptions ───────────────────────────────────
    const s7 = await runStage<any>(
      projectId, 7, "wireframes",
      `You are a UX designer. Generate detailed UI wireframe descriptions for all screens in the system.
Return a JSON object with this exact shape:
{
  "screens": [
    {
      "id": "SCR-001",
      "name": "Screen Name",
      "route": "/route",
      "description": "purpose of the screen",
      "components": [
        { "type": "type of component", "label": "label text", "purpose": "what it does" }
      ],
      "navigation": ["→ destination on action"]
    }
  ]
}
Cover all major screens implied by the functional requirements. Be detailed about components.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Actors: ${s1.actors?.join(", ")}
Key functional requirements:
${s2.requirements?.map((r: any) => `${r.id}: ${r.title}`).join("\n")}`,
      emit
    );

    // ── Stage 8: Traceability Matrix ─────────────────────────────────────────
    await runStage<any>(
      projectId, 8, "traceability_matrix",
      `You are a requirements manager. Build a traceability matrix linking functional requirements to test cases and security requirements.
Return a JSON object with this exact shape:
{
  "matrix": [
    {
      "fr_id": "FR-001",
      "fr_title": "title",
      "test_cases": ["TC-001", "TC-002"],
      "security_reqs": ["SR-001"]
    }
  ],
  "coverage": {
    "total_frs": 10,
    "covered_frs": 9,
    "total_tcs": 20,
    "percentage": 90
  }
}
Every FR must appear in the matrix. Link to relevant test cases and security requirements.`,
      `Functional requirements:
${s2.requirements?.map((r: any) => `${r.id}: ${r.title}`).join("\n")}

Functional test cases available: ${s5.test_cases?.map((t: any) => t.id).join(", ")}

Security requirements available: ${s4.requirements?.map((r: any) => r.id).join(", ")}`,
      emit
    );

    // ── Stage 9: UML Diagrams (Mermaid.js) ──────────────────────────────────
    await runStage<any>(
      projectId, 9, "uml_diagrams",
      `You are a software architect. Generate exactly 3 UML diagrams as valid Mermaid.js code.

Return a JSON object with this exact shape:
{
  "diagrams": [
    {
      "id": "UML-001",
      "title": "System Use Case Diagram",
      "type": "use_case",
      "description": "one-line description",
      "mermaid": "flowchart TD\\n  ActorName((Actor Label))\\n  UC1[Use Case One]\\n  ActorName --> UC1"
    },
    {
      "id": "UML-002",
      "title": "Domain Class Diagram",
      "type": "class",
      "description": "one-line description",
      "mermaid": "classDiagram\\n  class EntityName {\\n    +id String\\n    +field String\\n    +method()\\n  }\\n  EntityA --> EntityB : relation"
    },
    {
      "id": "UML-003",
      "title": "Main Sequence Diagram",
      "type": "sequence",
      "description": "one-line description",
      "mermaid": "sequenceDiagram\\n  actor User\\n  participant System\\n  participant DB\\n  User->>System: action\\n  System->>DB: query\\n  DB-->>System: result\\n  System-->>User: response"
    }
  ]
}

STRICT Mermaid syntax rules:
1. flowchart TD for use case: actors as ((Label)), use cases as [Label], arrows as -->
2. classDiagram: attributes as "+name Type", methods as "+method()", relations as "ClassA --> ClassB : label"
3. sequenceDiagram: use actor for humans, participant for systems; arrows ->> (solid) or -->>(dashed)
4. Node IDs must be alphanumeric with no spaces. Labels can have spaces inside quotes or parens.
5. Every \\n in the JSON string is a real newline in the diagram. Do NOT use actual newlines in the JSON value.
6. Keep each diagram concise (under 20 nodes/lines) for clarity.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Actors: ${s1.actors?.join(", ")}
Key functional requirements:
${s2.requirements?.slice(0, 8).map((r: any) => `${r.id}: ${r.title}`).join("\n")}
Main domain entities implied by requirements (infer from context).`,
      emit
    );

    // ── Stage 10: UI Code Generation ─────────────────────────────────────────
    const screensForCode = (s7.screens ?? []).slice(0, 8);
    await runStage<any>(
      projectId, 10, "ui_code",
      `You are a senior frontend developer. Generate a complete, working HTML page for each screen using Tailwind CSS (loaded via CDN).

Return a JSON object with this exact shape:
{
  "screens": [
    {
      "id": "SCR-001",
      "name": "Screen Name",
      "route": "/route",
      "html": "<!DOCTYPE html><html lang=\\"en\\"><head><meta charset=\\"UTF-8\\"><meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1.0\\"><title>Screen Name</title><script src=\\"https://cdn.tailwindcss.com\\"></script></head><body class=\\"bg-gray-50 min-h-screen\\"><!-- full page content --></body></html>"
    }
  ]
}

Rules:
1. Each HTML page must be fully standalone (includes Tailwind CDN script tag).
2. Use realistic placeholder text and data — not Lorem Ipsum.
3. Use a consistent design system: slate-900 background or white, indigo-600 as primary color, rounded-xl cards, clean typography.
4. Include all UI elements listed in the component list (inputs, buttons, tables, navigation, etc).
5. Make it look polished — use proper spacing, borders, hover states.
6. Navigation links can be # hrefs. Forms do not need to submit.
7. Each HTML value must be on ONE JSON string line — use \\n for newlines inside HTML.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}

Generate HTML for these screens:
${screensForCode.map((sc: any) => `
Screen: ${sc.name} (${sc.id}) — route: ${sc.route ?? ""}
Description: ${sc.description ?? ""}
Components: ${(sc.components ?? []).map((c: any) => `${c.type}: ${c.label} — ${c.purpose ?? ""}`).join("; ")}
Navigation: ${(sc.navigation ?? []).join(", ")}
`).join("\n---\n")}`,
      emit
    );

    await sql`UPDATE projects SET status = 'completed', updated_at = NOW() WHERE id = ${projectId}`;
  } catch {
    await sql`UPDATE projects SET status = 'failed', updated_at = NOW() WHERE id = ${projectId}`;
    throw new Error("Pipeline failed");
  }
}
