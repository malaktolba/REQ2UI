/**
 * Evaluation configuration — the version-controlled, configurable rubric used by
 * the GEval (LLM-as-a-Judge) quality evaluator.
 *
 * Everything that defines *how* a generated SRS/UI/UML/test suite is judged lives
 * here: the artifact weights, the per-artifact sub-criteria (each with its own
 * weight and concrete checks), the 1-5 scale, the grade thresholds, and the judge
 * prompt template. The evaluation service is intentionally generic — it reads this
 * config and asks the LLM to score against it — so the rubric can be tuned, or a
 * future version added, without touching service code.
 *
 * Versioning: bump `EVALUATION_CONFIG_VERSION` whenever the criteria or weights
 * change so stored evaluations remain interpretable (the version is persisted with
 * every report). This keeps evaluator behaviour reproducible across runs.
 */

/** Bump on any change to criteria, weights, or the judge prompt. */
export const EVALUATION_CONFIG_VERSION = "geval-v4";

/** The evaluation method. Architected so future methods (human review, automated
 *  UI testing, model comparison) can be added alongside without schema changes. */
export type EvaluationMethod = "geval";

/** The four artifact dimensions an evaluation covers. */
export type ArtifactKey = "srs" | "ui" | "uml" | "tests";

/** A single scored sub-criterion within an artifact dimension. */
export interface Criterion {
  /** Stable key, e.g. "coverage". */
  key: string;
  /** Human label shown in the report, e.g. "Requirement Coverage". */
  label: string;
  /** Share of the artifact score (the criteria within an artifact sum to 1). */
  weight: number;
  /** Concrete things the judge should check — embedded into the prompt verbatim. */
  checks: string[];
}

export interface ArtifactRubric {
  key: ArtifactKey;
  label: string;
  /** Share of the overall score (the four artifacts sum to 1). */
  weight: number;
  /** What this artifact is, for the judge's context line. */
  description: string;
  criteria: Criterion[];
}

// ── Overall weighting (must sum to 1.0) ───────────────────────────────────────
// Mirrors the product spec: UI is weighted highest as it's the headline output,
// then SRS, then UML, then tests.
export const ARTIFACT_WEIGHTS: Record<ArtifactKey, number> = {
  srs: 0.30,
  ui: 0.35,
  uml: 0.20,
  tests: 0.15,
};

// ── 1-5 scale and grading ─────────────────────────────────────────────────────
export const SCORE_SCALE = { min: 1, max: 5 } as const;

export const SCORE_LABELS: Record<number, string> = {
  5: "Excellent",
  4: "Good",
  3: "Acceptable",
  2: "Poor",
  1: "Failed",
};

/** Percentage thresholds (inclusive lower bound) → letter grade. Highest first. */
export const GRADE_THRESHOLDS: { min: number; grade: string }[] = [
  { min: 90, grade: "Excellent" },
  { min: 75, grade: "Good" },
  { min: 60, grade: "Acceptable" },
  { min: 40, grade: "Poor" },
  { min: 0, grade: "Failed" },
];

/** Maps an overall percentage (0-100) to its grade label. */
export function gradeForScore(percentage: number): string {
  for (const t of GRADE_THRESHOLDS) {
    if (percentage >= t.min) return t.grade;
  }
  return "Failed";
}

/** Converts a mean 1-5 score to a 0-100 percentage. */
export function scoreToPercentage(score: number): number {
  const { min, max } = SCORE_SCALE;
  const clamped = Math.max(min, Math.min(max, score));
  return Math.round(((clamped - min) / (max - min)) * 100);
}

// ── Per-artifact rubrics ──────────────────────────────────────────────────────

export const RUBRICS: ArtifactRubric[] = [
  {
    key: "srs",
    label: "SRS Document",
    weight: ARTIFACT_WEIGHTS.srs,
    description:
      "An IEEE 830 Software Requirements Specification: requirement extraction, functional, non-functional, and security requirements.",
    criteria: [
      {
        key: "coverage",
        label: "Requirement Coverage",
        weight: 0.4,
        checks: [
          "Are all features the user requested included?",
          "Are the relevant user roles / actors represented?",
          "Are the key workflows represented?",
          "Are the implied business rules captured?",
        ],
      },
      {
        key: "correctness",
        label: "Correctness",
        weight: 0.3,
        checks: [
          "Does the SRS correctly understand the user's request?",
          "Did it avoid inventing unnecessary or out-of-scope requirements?",
          "Are the requirements accurate and faithful to the intent?",
        ],
      },
      {
        key: "completeness",
        label: "Completeness",
        weight: 0.2,
        checks: [
          "Are functional requirements present?",
          "Are non-functional requirements present?",
          "Are security requirements present?",
          "Are constraints and assumptions stated?",
        ],
      },
      {
        key: "clarity",
        label: "Clarity",
        weight: 0.1,
        checks: [
          "Is the document well organized and structured?",
          "Is the formatting professional and consistent?",
          "Is each requirement unambiguous?",
        ],
      },
    ],
  },
  {
    key: "ui",
    label: "Generated UI",
    weight: ARTIFACT_WEIGHTS.ui,
    description:
      "Generated HTML/Tailwind screens for the system — a capped, REPRESENTATIVE set of up to ~6 screens (one per distinct screen category). This capped set is the COMPLETE intended UI deliverable by design, optionally constrained by user UI design preferences.",
    criteria: [
      {
        key: "alignment",
        label: "Requirement Alignment",
        weight: 0.4,
        checks: [
          "IMPORTANT: The UI is a CAPPED, REPRESENTATIVE set of up to ~6 screens (one per distinct category) — this is the COMPLETE intended deliverable BY DESIGN, NOT a partial sample. Do NOT penalize for additional screens, roles, or features lacking their own screen, nor for deduplicated/near-identical screens (e.g. Login vs Register, per-entity list/detail pages) being omitted. Missing screens are NOT a defect here.",
          "Among the screens that WERE generated, are the system's most important screen types and flows well chosen and represented? Judge the CHOICE and quality of the screens present — not the count, and never what was intentionally left out.",
          "Do the generated screens contain the components their purpose requires?",
          "Do the generated screens support their own core user flows?",
        ],
      },
      {
        key: "ux",
        label: "UX Quality",
        weight: 0.25,
        checks: [
          "Is navigation clear and consistent across screens?",
          "Is the overall user experience sound?",
          "Are basic accessibility practices followed (labels, semantics)?",
          "Is information hierarchy clear?",
        ],
      },
      {
        key: "visual",
        label: "Visual Quality",
        weight: 0.2,
        checks: [
          "Is the layout coherent?",
          "Is spacing and alignment consistent?",
          "Is styling consistent across screens?",
          "Does it look professional?",
        ],
      },
      {
        key: "preference_match",
        label: "Preference Match",
        weight: 0.15,
        checks: [
          "If the user specified a theme, is it honoured?",
          "If colours were specified, are they used?",
          "If a layout style was specified, does it match?",
          "If a component style was specified, does it match?",
          "If NO preferences were provided, judge this on sensible default design choices.",
        ],
      },
    ],
  },
  {
    key: "uml",
    label: "UML Diagrams",
    weight: ARTIFACT_WEIGHTS.uml,
    description: "UML diagrams (use-case, class, sequence) expressed as Mermaid.js.",
    criteria: [
      {
        key: "entity_coverage",
        label: "Entity Coverage",
        weight: 0.3,
        checks: ["Are all important domain entities/actors represented in the diagrams?"],
      },
      {
        key: "relationship_accuracy",
        label: "Relationship Accuracy",
        weight: 0.3,
        checks: ["Are the relationships between entities/actors correct and meaningful?"],
      },
      {
        key: "completeness",
        label: "Completeness",
        weight: 0.2,
        checks: ["Are the expected diagram types included (use-case, class, sequence)?"],
      },
      {
        key: "consistency",
        label: "Consistency with SRS",
        weight: 0.2,
        checks: ["Do the diagrams agree with the entities and behaviour described in the SRS?"],
      },
    ],
  },
  {
    key: "tests",
    label: "Test Cases",
    weight: ARTIFACT_WEIGHTS.tests,
    description: "IEEE 829 functional and security test cases derived from the requirements.",
    criteria: [
      {
        key: "coverage",
        label: "Requirement Coverage",
        weight: 0.4,
        checks: ["Do the test cases cover the generated functional and security requirements?"],
      },
      {
        key: "quality",
        label: "Test Quality",
        weight: 0.35,
        checks: [
          "Are positive scenarios covered?",
          "Are negative scenarios covered?",
          "Are edge cases considered?",
          "Are expected results clearly specified?",
        ],
      },
      {
        key: "accuracy",
        label: "Accuracy",
        weight: 0.25,
        checks: ["Do the tests match the actual described system behaviour?"],
      },
    ],
  },
];

/** Look up a rubric by key. */
export function rubricFor(key: ArtifactKey): ArtifactRubric {
  const r = RUBRICS.find((x) => x.key === key);
  if (!r) throw new Error(`No rubric for artifact "${key}"`);
  return r;
}

// ── Judge prompt (version-controlled) ─────────────────────────────────────────

/**
 * Builds the GEval system prompt for one artifact dimension. The judge scores
 * each criterion on the 1-5 scale and returns structured JSON. The prompt is
 * deliberately strict about the evaluator's role: assess quality ONLY, never
 * generate or modify the artifact.
 */
export function buildJudgeSystemPrompt(rubric: ArtifactRubric): string {
  const scaleLines = Object.entries(SCORE_LABELS)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([n, label]) => `  ${n} = ${label}`)
    .join("\n");

  const criteriaBlock = rubric.criteria
    .map((c, i) => {
      const checks = c.checks.map((ch) => `     - ${ch}`).join("\n");
      return `  ${i + 1}. "${c.key}" — ${c.label} (weight ${Math.round(c.weight * 100)}%)\n${checks}`;
    })
    .join("\n");

  const keys = rubric.criteria.map((c) => `"${c.key}"`).join(", ");

  return `You are a meticulous, impartial software quality evaluator using the GEval (LLM-as-a-Judge) method.
You assess the QUALITY of a generated ${rubric.label} for a software project. ${rubric.description}

CRITICAL RULES:
- You ONLY analyse and score quality. You NEVER generate, rewrite, or modify the artifact.
- Be objective and evidence-based. Justify each score with specifics from the material.
- If an artifact is missing or empty, score the affected criteria 1 (Failed) and say so.

SCORING SCALE (integers only):
${scaleLines}

EVALUATE THESE CRITERIA:
${criteriaBlock}

Return ONLY a JSON object with this exact shape:
{
  "criteria": [
    { "key": <one of ${keys}>, "score": <1-5 integer>, "justification": "<one concise sentence>" }
  ],
  "strengths": ["<specific strength>", "..."],
  "issues": ["<specific weakness or gap>", "..."],
  "recommendations": ["<concrete, actionable improvement>", "..."]
}
Include exactly one entry in "criteria" for every criterion key listed above. Provide 1-4 strengths,
1-4 issues, and 1-3 recommendations. Keep every string short and concrete.`;
}
