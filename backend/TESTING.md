# REQ2UI — Testing & Evaluation

This document describes the automated test suite and the quantitative evaluation
tooling. It is the source for the thesis **Testing** chapter: it covers both
*functional* correctness (does the application behave correctly?) and
*non-functional* quality (how accurate and how fast is the AI pipeline?).

## 1. Running the tests

```bash
cd backend
npm test               # run the full Jest suite (79 tests)
npm run test:coverage  # same, with a coverage report
```

The suite uses Jest + ts-jest + supertest. The database and the LLM clients
(Groq, Gemini) are mocked, so the tests are deterministic, offline, and cost no
API tokens.

## 2. Functional test coverage

| Area | File | What it verifies |
|---|---|---|
| Authentication routes | `auth.routes.test.ts` | register/login/logout, validation, lockout-relevant paths, wrong-password handling |
| Auth middleware | `auth.middleware.test.ts` | Bearer-header and `?token=` (SSE) auth, 401 on missing/invalid token |
| Token service | `token.service.test.ts` | access-token sign/verify, refresh-token rotation, **theft detection** (family revoke), expiry |
| Project CRUD | `projects.routes.test.ts` | auth gate, Zod validation, ownership scoping, soft delete |
| Pipeline orchestration | `pipeline.service.test.ts` | all 10 stages run in order, resume-from-cache skips the LLM, Stage-2 floor check, per-stage timing instrumentation |
| Pipeline helpers | `pipeline.helpers.test.ts` | screen categorisation, distinct-screen selection, Mermaid sanitisation |
| Export service | `export.service.test.ts` | LaTeX/CSV generation structure and content |
| Metrics engine | `metrics.service.test.ts` | the accuracy rubric scores good SRSs high and degraded SRSs low |

## 3. Non-functional evaluation

### 3.1 Accuracy (SRS quality)

`src/services/metrics.service.ts` scores a generated SRS against measurable,
standards-derived rubrics and reports an overall **accuracy %**. Metrics are
grouped into four dimensions:

- **Completeness** — every stage produced output; minimum requirement counts met
  (≥10 FRs, ≥8 NFRs, ≥8 SRs, ≥3 UML diagrams, ≥10 extracted statements).
- **Conformance** — schema correctness (required fields present), ID formats
  (`FR-001`, `NFR-001`, …), and IEEE-830 *"The system shall"* phrasing.
- **Coverage** — every functional requirement is covered by ≥1 test case and
  appears in the traceability matrix; ≥2 test cases per FR; security tests cover
  security requirements.
- **Validity** — priorities are valid levels, NFR categories are recognised
  quality attributes, security requirements map to valid OWASP 2021 categories,
  and UML diagrams contain valid Mermaid syntax.

The overall accuracy is the mean of all individual metric scores (each in
`[0,1]`). The rubric is unit-tested against a golden fixture
(`__tests__/fixtures/sample-srs.ts`) and degraded variants.

### 3.2 Producing the numbers

**Accuracy over all existing projects (free — reads the DB, no LLM calls):**

```bash
npm run report                 # all completed projects
npm run report -- <projectId>  # a single project
```

Writes `reports/srs-quality-report.{json,md}` with: mean accuracy, accuracy by
dimension, accuracy per project, and the mean score per individual rubric.

**Generation time (accurate, costs API tokens):**

```bash
npm run bench -- <projectId>            # one fresh, timed run
npm run bench -- <projectId> --runs=3   # average over 3 runs
```

Writes `reports/benchmark-report.{json,md}` with per-stage mean/min/max seconds
and end-to-end total, plus the accuracy of the freshly generated SRS.

> **Why two tools?** The pipeline supports resume, so historical
> `pipeline_stages` timestamps can span multiple sessions and overstate the real
> generation time. The DB report therefore *excludes* implausible (>300 s)
> resume-contaminated spans, and the dedicated `bench` command measures a fresh
> run in-process with a monotonic clock for trustworthy timing figures.

## 4. Suggested thesis tables

- **Table: Functional test coverage** — section 2 above (area / file / verifies).
- **Table: SRS accuracy by dimension** — from `srs-quality-report.md` §1.1.
- **Table: Accuracy per project** — from `srs-quality-report.md` §1.2.
- **Table: Mean score per rubric** — from `srs-quality-report.md` §1.3.
- **Table: Average generation time per stage** — from `benchmark-report.md`.
