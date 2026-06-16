import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProject, fetchArtifacts } from "../api/projects";
import type { Project, Artifact } from "../types/project";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";

// ─── Tab configuration ──────────────────────────────────────────────────────

const TABS = [
  { key: "extraction",                label: "Extraction",        short: "EX"  },
  { key: "functional_requirements",   label: "Functional Req.",   short: "FR"  },
  { key: "non_functional_requirements", label: "Non-Functional",  short: "NFR" },
  { key: "security_requirements",     label: "Security Req.",     short: "SR"  },
  { key: "functional_test_cases",     label: "Func. Tests",       short: "TC"  },
  { key: "security_test_cases",       label: "Security Tests",    short: "STC" },
  { key: "wireframes",                label: "Wireframes",        short: "UI"  },
  { key: "traceability_matrix",       label: "Traceability",      short: "TM"  },
] as const;

type TabKey = typeof TABS[number]["key"];

// ─── Priority/severity badge ─────────────────────────────────────────────────

function Badge({ value }: { value: string }) {
  const color =
    value === "Critical" ? "bg-red-500/20 text-red-400 border-red-500/30" :
    value === "High"     ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
    value === "Medium"   ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
    value === "Low"      ? "bg-green-500/20 text-green-400 border-green-500/30" :
                           "bg-slate-700/50 text-slate-400 border-slate-600";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${color}`}>
      {value}
    </span>
  );
}

// ─── Individual artifact renderers ───────────────────────────────────────────

function ExtractionView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {data.system_summary && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">System Summary</h3>
          <p className="text-slate-200 text-sm leading-relaxed">{data.system_summary}</p>
        </div>
      )}
      {data.actors?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Actors</h3>
          <div className="flex flex-wrap gap-2">
            {data.actors.map((a: string, i: number) => (
              <span key={i} className="bg-slate-800 border border-slate-700 text-slate-300 text-sm px-3 py-1 rounded-full">{a}</span>
            ))}
          </div>
        </div>
      )}
      {data.extracted?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Extracted Requirements <span className="text-slate-600 normal-case font-normal">({data.extracted.length})</span>
          </h3>
          <ol className="space-y-2">
            {data.extracted.map((req: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300">
                <span className="text-slate-600 font-mono w-6 flex-shrink-0 pt-0.5">{i + 1}.</span>
                <span className="leading-relaxed">{req}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function FRView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {data.requirements?.map((r: any) => (
        <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">{r.id}</span>
              <h3 className="font-semibold text-sm text-slate-200">{r.title}</h3>
            </div>
            <Badge value={r.priority} />
          </div>
          <p className="text-slate-400 text-sm leading-relaxed mb-3">{r.description}</p>
          {r.acceptance_criteria?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1.5">Acceptance Criteria</p>
              <ul className="space-y-1">
                {r.acceptance_criteria.map((c: string, i: number) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-2">
                    <span className="text-green-500 flex-shrink-0">✓</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function NFRView({ data }: { data: any }) {
  const categories = [...new Set(data.requirements?.map((r: any) => r.category) ?? [])];
  return (
    <div className="space-y-6">
      {categories.map((cat: any) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 border-b border-slate-800 pb-2">{cat}</h3>
          <div className="space-y-3">
            {data.requirements?.filter((r: any) => r.category === cat).map((r: any) => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded">{r.id}</span>
                  <span className="font-medium text-sm text-slate-200">{r.title}</span>
                </div>
                <p className="text-slate-400 text-sm mb-2">{r.description}</p>
                {r.metric && (
                  <p className="text-xs text-slate-500">
                    <span className="text-slate-600 font-semibold">Metric: </span>{r.metric}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SRView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {data.requirements?.map((r: any) => (
        <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">{r.id}</span>
                <span className="font-semibold text-sm text-slate-200">{r.title}</span>
              </div>
              {r.owasp_category && (
                <span className="text-xs text-orange-400/80">{r.owasp_category}</span>
              )}
            </div>
            <Badge value={r.priority} />
          </div>
          <p className="text-slate-400 text-sm leading-relaxed mb-3">{r.description}</p>
          {r.controls?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1.5">Controls</p>
              <ul className="space-y-1">
                {r.controls.map((c: string, i: number) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-2">
                    <span className="text-blue-500 flex-shrink-0">→</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FTCView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {data.test_cases?.map((tc: any) => (
        <div key={tc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">{tc.id}</span>
              {tc.fr_id && <span className="text-xs text-slate-500">covers {tc.fr_id}</span>}
              <span className="font-semibold text-sm text-slate-200">{tc.title}</span>
            </div>
            <Badge value={tc.priority} />
          </div>
          {tc.preconditions && (
            <p className="text-xs text-slate-500 mb-3">
              <span className="font-semibold text-slate-600">Preconditions: </span>{tc.preconditions}
            </p>
          )}
          <div className="mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Steps</p>
            <ol className="space-y-1">
              {tc.steps?.map((s: string, i: number) => (
                <li key={i} className="text-sm text-slate-300 flex gap-2">
                  <span className="text-slate-600 font-mono flex-shrink-0 w-5">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          {tc.expected_result && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
              <p className="text-xs text-slate-500 font-semibold mb-1">Expected Result</p>
              <p className="text-sm text-green-300">{tc.expected_result}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function STCView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {data.test_cases?.map((tc: any) => (
        <div key={tc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">{tc.id}</span>
              {tc.sr_id && <span className="text-xs text-slate-500">covers {tc.sr_id}</span>}
              <span className="font-semibold text-sm text-slate-200">{tc.title}</span>
            </div>
            <Badge value={tc.severity} />
          </div>
          {tc.attack_vector && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-3">
              <p className="text-xs text-slate-500 font-semibold mb-1">Attack Vector</p>
              <p className="text-sm text-red-300">{tc.attack_vector}</p>
            </div>
          )}
          <div className="mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Steps</p>
            <ol className="space-y-1">
              {tc.steps?.map((s: string, i: number) => (
                <li key={i} className="text-sm text-slate-300 flex gap-2">
                  <span className="text-slate-600 font-mono flex-shrink-0 w-5">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          {tc.expected_result && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
              <p className="text-xs text-slate-500 font-semibold mb-1">Expected (Secure) Result</p>
              <p className="text-sm text-green-300">{tc.expected_result}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Visual wireframe helpers ────────────────────────────────────────────────

function WireframeShape({ c }: { c: any }) {
  const t = (c.type ?? "").toLowerCase();

  if (/navbar|header|app.?bar|navigation.?bar|top.?bar/.test(t))
    return (
      <div className="w-full h-8 bg-slate-700 flex items-center px-2 gap-1.5 flex-shrink-0">
        <div className="w-2 h-2 bg-indigo-500/70 rounded-sm" />
        <div className="h-1.5 bg-slate-500 rounded flex-1 max-w-[50%]" />
        <div className="w-5 h-5 bg-slate-600 rounded-full ml-auto" />
      </div>
    );

  if (/search/.test(t))
    return (
      <div className="mx-2 h-6 bg-slate-700 rounded-full flex items-center px-2 gap-1.5 flex-shrink-0">
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-slate-500 flex-shrink-0"><circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="7" y1="7" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.5"/></svg>
        <div className="h-1.5 bg-slate-600 rounded flex-1" />
      </div>
    );

  if (/button|cta|submit|action/.test(t))
    return (
      <div className="mx-2 flex-shrink-0">
        <div className="h-7 bg-indigo-600/60 rounded-full flex items-center justify-center px-4">
          <div className="h-1.5 bg-indigo-300/80 rounded w-14" />
        </div>
      </div>
    );

  if (/input|text.?field|form.?field|email|password|text.?input|field/.test(t))
    return (
      <div className="mx-2 h-7 border border-slate-600 rounded-md bg-slate-800/60 flex items-center px-2 flex-shrink-0">
        <div className="h-1.5 bg-slate-600 rounded w-2/3" />
        <div className="w-1 h-4 bg-slate-500 ml-1 opacity-60 animate-pulse" />
      </div>
    );

  if (/image|avatar|banner|photo|picture|thumbnail/.test(t))
    return (
      <div className="mx-2 h-14 bg-slate-700 rounded-md flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 20 20" className="text-slate-500"><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/><path d="M2 13l4-4 3 3 3-3 6 6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
      </div>
    );

  if (/card|post.?card|product.?card|item.?card/.test(t))
    return (
      <div className="mx-2 border border-slate-600 rounded-md p-2 flex-shrink-0">
        <div className="h-1.5 bg-slate-400 rounded w-3/4 mb-1.5" />
        <div className="h-1 bg-slate-700 rounded mb-1" />
        <div className="h-1 bg-slate-700 rounded w-5/6" />
      </div>
    );

  if (/list|feed|table|data.?table|grid/.test(t))
    return (
      <div className="mx-2 flex-shrink-0 rounded-md overflow-hidden border border-slate-700">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-5 flex items-center px-2 gap-2 ${i % 2 === 0 ? "bg-slate-800" : "bg-slate-800/40"}`}>
            <div className="w-2 h-2 bg-slate-600 rounded-sm flex-shrink-0" />
            <div className="h-1 bg-slate-600 rounded flex-1" />
            <div className="h-1 bg-slate-700 rounded w-8" />
          </div>
        ))}
      </div>
    );

  if (/tab.?bar|bottom.?nav|bottom.?navigation|footer/.test(t))
    return (
      <div className="w-full h-9 bg-slate-800 border-t border-slate-700 flex items-center justify-around px-4 mt-auto flex-shrink-0">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div className={`w-3.5 h-3.5 rounded-sm ${i === 0 ? "bg-indigo-500" : "bg-slate-600"}`} />
            <div className="h-1 w-5 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );

  if (/heading|title/.test(t))
    return (
      <div className="mx-2 flex-shrink-0">
        <div className="h-3 bg-slate-300/60 rounded w-2/3 mb-1" />
      </div>
    );

  if (/text|label|paragraph|description/.test(t))
    return (
      <div className="mx-2 flex-shrink-0 space-y-1">
        <div className="h-1.5 bg-slate-600 rounded" />
        <div className="h-1.5 bg-slate-600 rounded w-5/6" />
        <div className="h-1.5 bg-slate-700 rounded w-3/4" />
      </div>
    );

  if (/icon|badge/.test(t))
    return (
      <div className="mx-2 w-7 h-7 bg-slate-700 rounded-lg flex-shrink-0 flex items-center justify-center">
        <div className="w-3 h-3 bg-slate-500 rounded-sm" />
      </div>
    );

  if (/notification|alert|banner/.test(t))
    return (
      <div className="mx-2 h-8 bg-indigo-900/60 border border-indigo-700/50 rounded-md flex items-center px-2 gap-1.5 flex-shrink-0">
        <div className="w-2 h-2 bg-indigo-400 rounded-full flex-shrink-0" />
        <div className="h-1.5 bg-indigo-600/80 rounded flex-1" />
      </div>
    );

  // default — generic labeled block
  return (
    <div className="mx-2 h-7 border border-dashed border-slate-700 rounded-md flex items-center px-2 gap-1.5 flex-shrink-0">
      <div className="h-1.5 bg-slate-600 rounded flex-1" />
      <span className="text-[8px] text-slate-600 font-mono flex-shrink-0 uppercase">{(c.type ?? "").slice(0, 8)}</span>
    </div>
  );
}

function PhoneMockup({ components }: { components: any[] }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: 200, height: 390 }}>
      {/* phone shell */}
      <div className="absolute inset-0 rounded-[30px] border-[5px] border-slate-600 bg-slate-900 overflow-hidden shadow-2xl shadow-black/60">
        {/* status bar */}
        <div className="h-5 bg-slate-800/80 flex items-center justify-between px-3 flex-shrink-0">
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-slate-500 rounded-full" />
            <div className="w-1 h-1 bg-slate-500 rounded-full" />
            <div className="w-1 h-1 bg-slate-500 rounded-full" />
          </div>
          <div className="w-8 h-2 bg-slate-700 rounded-sm" />
        </div>
        {/* content area */}
        <div className="flex flex-col gap-1.5 py-1.5 overflow-hidden" style={{ height: "calc(100% - 20px)" }}>
          {components.map((c, i) => <WireframeShape key={i} c={c} />)}
        </div>
      </div>
      {/* side button */}
      <div className="absolute -right-[5px] top-20 w-[4px] h-10 bg-slate-600 rounded-r-sm" />
      <div className="absolute -left-[5px] top-16 w-[4px] h-7 bg-slate-600 rounded-l-sm" />
      <div className="absolute -left-[5px] top-[100px] w-[4px] h-7 bg-slate-600 rounded-l-sm" />
      {/* home indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-600 rounded-full" />
    </div>
  );
}

function WireframesView({ data }: { data: any }) {
  return (
    <div className="space-y-8">
      {data.screens?.map((sc: any) => (
        <div key={sc.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span className="text-xs font-mono text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded">{sc.id}</span>
            <span className="font-bold text-slate-200">{sc.name}</span>
            {sc.route && <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded">{sc.route}</span>}
          </div>

          <div className="flex gap-8 flex-wrap">
            <PhoneMockup components={sc.components ?? []} />

            <div className="flex-1 min-w-[180px] space-y-4">
              {sc.description && (
                <p className="text-slate-400 text-sm leading-relaxed">{sc.description}</p>
              )}
              {sc.components?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">
                    Components <span className="text-slate-700 font-normal normal-case">({sc.components.length})</span>
                  </p>
                  <div className="space-y-1.5">
                    {sc.components.map((c: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono flex-shrink-0">{c.type}</span>
                        <span className="text-slate-300 font-medium">{c.label}</span>
                        {c.purpose && <span className="text-slate-600">— {c.purpose}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {sc.navigation?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Navigation</p>
                  <ul className="space-y-1">
                    {sc.navigation.map((n: string, i: number) => (
                      <li key={i} className="text-xs text-indigo-400 flex gap-1.5">
                        <span className="flex-shrink-0">→</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TraceabilityView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {data.coverage && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total FRs", value: data.coverage.total_frs },
            { label: "Covered FRs", value: data.coverage.covered_frs },
            { label: "Total TCs", value: data.coverage.total_tcs },
            { label: "Coverage", value: `${data.coverage.percentage}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-indigo-400">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 pr-4 w-24">FR ID</th>
              <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 pr-4">Title</th>
              <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 pr-4">Test Cases</th>
              <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3">Security Reqs</th>
            </tr>
          </thead>
          <tbody>
            {data.matrix?.map((row: any) => (
              <tr key={row.fr_id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                <td className="py-3 pr-4">
                  <span className="text-xs font-mono text-indigo-400">{row.fr_id}</span>
                </td>
                <td className="py-3 pr-4 text-slate-300">{row.fr_title}</td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {row.test_cases?.map((tc: string) => (
                      <span key={tc} className="text-xs bg-teal-500/10 border border-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded font-mono">{tc}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.security_reqs?.map((sr: string) => (
                      <span key={sr} className="text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-mono">{sr}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Artifact count helper ───────────────────────────────────────────────────

function artifactCount(key: TabKey, content: any): number | null {
  if (!content) return null;
  switch (key) {
    case "extraction":                  return content.extracted?.length ?? null;
    case "functional_requirements":     return content.requirements?.length ?? null;
    case "non_functional_requirements": return content.requirements?.length ?? null;
    case "security_requirements":       return content.requirements?.length ?? null;
    case "functional_test_cases":       return content.test_cases?.length ?? null;
    case "security_test_cases":         return content.test_cases?.length ?? null;
    case "wireframes":                  return content.screens?.length ?? null;
    case "traceability_matrix":         return content.matrix?.length ?? null;
    default:                            return null;
  }
}

function ArtifactSummary({ tabKey, content }: { tabKey: TabKey; content: any }) {
  if (!content) return null;
  let text = "";
  switch (tabKey) {
    case "extraction":
      text = `${content.extracted?.length ?? 0} requirements extracted · ${content.actors?.length ?? 0} actors`;
      break;
    case "functional_requirements": {
      const high = content.requirements?.filter((r: any) => r.priority === "High").length ?? 0;
      text = `${content.requirements?.length ?? 0} requirements · ${high} high priority`;
      break;
    }
    case "non_functional_requirements": {
      const cats = new Set(content.requirements?.map((r: any) => r.category) ?? []).size;
      text = `${content.requirements?.length ?? 0} requirements across ${cats} categories`;
      break;
    }
    case "security_requirements":
      text = `${content.requirements?.length ?? 0} security requirements mapped to OWASP Top 10`;
      break;
    case "functional_test_cases":
      text = `${content.test_cases?.length ?? 0} test cases (IEEE 829)`;
      break;
    case "security_test_cases":
      text = `${content.test_cases?.length ?? 0} security test cases`;
      break;
    case "wireframes":
      text = `${content.screens?.length ?? 0} screens`;
      break;
    case "traceability_matrix": {
      const cov = content.coverage;
      text = cov ? `${cov.covered_frs}/${cov.total_frs} FRs covered · ${cov.total_tcs} test cases · ${cov.percentage}% coverage` : "";
      break;
    }
  }
  if (!text) return null;
  return (
    <div className="flex items-center gap-2 mb-5 text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
      {text}
    </div>
  );
}

// ─── Content dispatcher ──────────────────────────────────────────────────────

function ArtifactContent({ tabKey, content }: { tabKey: TabKey; content: any }) {
  if (!content) return <p className="text-slate-500 text-sm">No data available.</p>;
  return (
    <>
      <ArtifactSummary tabKey={tabKey} content={content} />
      {(() => {
        switch (tabKey) {
          case "extraction":                return <ExtractionView data={content} />;
          case "functional_requirements":   return <FRView data={content} />;
          case "non_functional_requirements": return <NFRView data={content} />;
          case "security_requirements":     return <SRView data={content} />;
          case "functional_test_cases":     return <FTCView data={content} />;
          case "security_test_cases":       return <STCView data={content} />;
          case "wireframes":                return <WireframesView data={content} />;
          case "traceability_matrix":       return <TraceabilityView data={content} />;
          default:                          return <pre className="text-xs text-slate-400 overflow-auto">{JSON.stringify(content, null, 2)}</pre>;
        }
      })()}
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ArtifactsViewer() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("extraction");
  const [exporting, setExporting] = useState<string | null>(null);
  const toast = useToast();

  async function handleExport(format: "pdf" | "docx" | "csv") {
    if (!id || exporting) return;
    setExporting(format);
    try {
      const res = await api.get(`/projects/${id}/export/${format}`, { responseType: "blob" });
      const mime =
        format === "pdf" ? "application/pdf" :
        format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
        "text/csv";
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.name ?? "project"}_req2ui.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} downloaded.`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}.`);
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchProject(id), fetchArtifacts(id)]).then(([p, arts]) => {
      setProject(p);
      setArtifacts(arts);
      if (arts.length > 0) setActiveTab(arts[0].type as TabKey);
      setLoading(false);
    });
  }, [id]);

  const artifactMap = Object.fromEntries(artifacts.map((a) => [a.type, a.content]));
  const availableKeys = new Set(artifacts.map((a) => a.type));

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">
          <Link to="/dashboard" className="text-slate-400 hover:text-white transition text-sm">
            ← Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <Link to={`/projects/${id}`} className="text-slate-400 hover:text-white transition text-sm truncate max-w-xs">
            {project?.name}
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 text-sm font-medium">Artifacts</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-600 mr-2">{artifacts.length} / 8 artifacts</span>
            {(["pdf", "docx", "csv"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                disabled={!!exporting || artifacts.length === 0}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed uppercase"
              >
                {exporting === fmt ? "…" : fmt}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-4 mb-8 scrollbar-none border-b border-slate-800">
          {TABS.map((tab) => {
            const available = availableKeys.has(tab.key);
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => available && setActiveTab(tab.key)}
                disabled={!available}
                className={[
                  "flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition",
                  active
                    ? "bg-indigo-600 text-white"
                    : available
                    ? "text-slate-400 hover:text-white hover:bg-slate-800"
                    : "text-slate-700 cursor-not-allowed",
                ].join(" ")}
              >
                <span className="hidden sm:inline">
                  {tab.label}
                  {(() => { const n = artifactCount(tab.key, artifactMap[tab.key]); return n !== null ? <span className={`ml-1 text-xs ${active ? "text-indigo-200" : "text-slate-600"}`}>({n})</span> : null; })()}
                </span>
                <span className="sm:hidden">{tab.short}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <ArtifactContent tabKey={activeTab} content={artifactMap[activeTab]} />
      </div>
    </div>
  );
}
