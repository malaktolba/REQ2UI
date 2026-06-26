import { useState, useEffect, useRef, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProject, fetchArtifacts } from "../api/projects";
import type { Project, Artifact } from "../types/project";
import api from "../api/axios";
import { CheckIcon, ArrowRight, ChevronDown, ArrowLeft } from "../components/Icons";
import { ThemeToggle } from "../components/ThemeToggle";
import { UIRefinementPanel } from "../components/UIRefinementPanel";
import { QualityReport } from "../components/QualityReport";
import { useToast } from "../context/ToastContext";
import { LoadingScreen } from "../components/LoadingScreen";

// ─── Tab configuration ──────────────────────────────────────────────────────

const TABS = [
  { key: "srs_document",              label: "SRS Doc",           short: "SRS" },
  { key: "extraction",                label: "Extraction",        short: "EX"  },
  { key: "functional_requirements",   label: "Functional Req.",   short: "FR"  },
  { key: "non_functional_requirements", label: "Non-Functional",  short: "NFR" },
  { key: "security_requirements",     label: "Security Req.",     short: "SR"  },
  { key: "functional_test_cases",     label: "Func. Tests",       short: "TC"  },
  { key: "security_test_cases",       label: "Security Tests",    short: "STC" },
  { key: "wireframes",                label: "Wireframes",        short: "WF"  },
  { key: "ui_code",                   label: "UI Code",           short: "UI"  },
  { key: "uml_diagrams",             label: "Diagrams",          short: "UML" },
  { key: "traceability_matrix",       label: "Traceability",      short: "TM"  },
  { key: "quality_report",            label: "Quality",           short: "QA"  },
] as const;

type TabKey = typeof TABS[number]["key"];

// ─── Priority/severity badge ─────────────────────────────────────────────────

function Badge({ value }: { value: string }) {
  const color =
    value === "Critical" ? "bg-red-500/20 light:bg-red-50 text-red-400 light:text-red-700 border-red-500/30 light:border-red-200" :
    value === "High"     ? "bg-orange-500/20 light:bg-orange-50 text-orange-400 light:text-orange-700 border-orange-500/30 light:border-orange-200" :
    value === "Medium"   ? "bg-yellow-500/20 light:bg-yellow-50 text-yellow-400 light:text-yellow-700 border-yellow-500/30 light:border-yellow-200" :
    value === "Low"      ? "bg-green-500/20 light:bg-green-50 text-green-400 light:text-green-700 border-green-500/30 light:border-green-200" :
                           "bg-slate-700/50 light:bg-slate-100 text-slate-400 light:text-slate-600 border-slate-600 light:border-slate-300";
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
        <div className="bg-indigo-500/10 light:bg-indigo-50 border border-indigo-500/30 light:border-indigo-200 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-indigo-400 light:text-indigo-600 uppercase tracking-wide mb-2">System Summary</h3>
          <p className="text-slate-200 light:text-slate-700 text-sm leading-relaxed">{data.system_summary}</p>
        </div>
      )}
      {data.actors?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 light:text-slate-500 uppercase tracking-wide mb-3">Actors</h3>
          <div className="flex flex-wrap gap-2">
            {data.actors.map((a: string, i: number) => (
              <span key={i} className="bg-slate-800 light:bg-slate-100 border border-slate-700 light:border-slate-200 text-slate-300 light:text-slate-700 text-sm px-3 py-1 rounded-full">{a}</span>
            ))}
          </div>
        </div>
      )}
      {data.extracted?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 light:text-slate-500 uppercase tracking-wide mb-3">
            Extracted Requirements <span className="text-slate-600 light:text-slate-400 normal-case font-normal">({data.extracted.length})</span>
          </h3>
          <ol className="space-y-2">
            {data.extracted.map((req: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300 light:text-slate-700">
                <span className="text-slate-600 light:text-slate-400 font-mono w-6 flex-shrink-0 pt-0.5">{i + 1}.</span>
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
      {data.requirements?.map((r: any, idx: number) => (
        <div key={r.id} className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xs text-slate-600 light:text-slate-400 font-mono flex-shrink-0">3.1.{idx + 1}</span>
              <span className="text-xs font-mono text-indigo-400 light:text-indigo-600 bg-indigo-500/10 light:bg-indigo-50 border border-indigo-500/20 light:border-indigo-200 px-2 py-0.5 rounded">{r.id}</span>
              <h3 className="font-bold text-sm text-slate-100 light:text-slate-800">— {r.title}</h3>
            </div>
            <Badge value={r.priority} />
          </div>
          <div className="grid grid-cols-[100px_1fr] text-xs border border-slate-800 light:border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-slate-800/50 light:bg-slate-50 px-3 py-2 text-slate-500 font-medium border-b border-slate-800 light:border-slate-200">Priority</div>
            <div className="px-3 py-2 border-b border-slate-800 light:border-slate-200"><Badge value={r.priority} /></div>
            <div className="bg-slate-800/50 light:bg-slate-50 px-3 py-2 text-slate-500 font-medium">Description</div>
            <div className="px-3 py-2 text-slate-300 light:text-slate-700 leading-relaxed">{r.description}</div>
          </div>
          {r.acceptance_criteria?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Acceptance Criteria</p>
              <ul className="space-y-1.5">
                {r.acceptance_criteria.map((c: string, i: number) => (
                  <li key={i} className="text-sm text-slate-300 light:text-slate-700 flex gap-2">
                    <CheckIcon size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
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
  const categories = [...new Set(data.requirements?.map((r: any) => r.category) ?? [])] as string[];
  return (
    <div className="space-y-8">
      {categories.map((cat, catIdx) => (
        <div key={cat}>
          <div className="flex items-baseline gap-3 pb-2 border-b border-slate-800 light:border-slate-200 mb-4">
            <span className="text-xs text-slate-600 light:text-slate-400 font-mono flex-shrink-0">3.2.{catIdx + 1}</span>
            <h3 className="text-xs font-bold text-slate-300 light:text-slate-700 uppercase tracking-widest">{cat}</h3>
          </div>
          <div className="space-y-3 pl-6">
            {data.requirements?.filter((r: any) => r.category === cat).map((r: any) => (
              <div key={r.id} className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono text-violet-400 light:text-violet-600 bg-violet-500/10 light:bg-violet-50 border border-violet-500/20 light:border-violet-200 px-2 py-0.5 rounded">{r.id}</span>
                  <span className="font-semibold text-sm text-slate-200 light:text-slate-800">— {r.title}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] text-xs border border-slate-800 light:border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-800/50 light:bg-slate-50 px-3 py-2 text-slate-500 font-medium border-b border-slate-800 light:border-slate-200">Description</div>
                  <div className="px-3 py-2 text-slate-300 light:text-slate-700 border-b border-slate-800 light:border-slate-200 leading-relaxed">{r.description}</div>
                  {r.metric && (
                    <>
                      <div className="bg-slate-800/50 light:bg-slate-50 px-3 py-2 text-slate-500 font-medium">Metric</div>
                      <div className="px-3 py-2 text-green-300 light:text-green-700 font-mono">{r.metric}</div>
                    </>
                  )}
                </div>
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
      {data.requirements?.map((r: any, idx: number) => (
        <div key={r.id} className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xs text-slate-600 light:text-slate-400 font-mono flex-shrink-0">3.3.{idx + 1}</span>
              <span className="text-xs font-mono text-red-400 light:text-red-600 bg-red-500/10 light:bg-red-50 border border-red-500/20 light:border-red-200 px-2 py-0.5 rounded">{r.id}</span>
              <span className="font-bold text-sm text-slate-100 light:text-slate-800">— {r.title}</span>
            </div>
            <Badge value={r.priority} />
          </div>
          {r.owasp_category && (
            <div className="border-l-2 border-orange-500 pl-3 mb-4 py-0.5">
              <span className="text-xs text-orange-400 light:text-orange-600 font-medium">{r.owasp_category}</span>
            </div>
          )}
          <div className="grid grid-cols-[100px_1fr] text-xs border border-slate-800 light:border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-slate-800/50 light:bg-slate-50 px-3 py-2 text-slate-500 font-medium border-b border-slate-800 light:border-slate-200">Priority</div>
            <div className="px-3 py-2 border-b border-slate-800 light:border-slate-200"><Badge value={r.priority} /></div>
            <div className="bg-slate-800/50 light:bg-slate-50 px-3 py-2 text-slate-500 font-medium">Description</div>
            <div className="px-3 py-2 text-slate-300 light:text-slate-700 leading-relaxed">{r.description}</div>
          </div>
          {r.controls?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Security Controls</p>
              <ul className="space-y-1.5">
                {r.controls.map((c: string, i: number) => (
                  <li key={i} className="text-sm text-slate-300 light:text-slate-700 flex gap-2">
                    <ArrowRight size={13} className="text-blue-400 light:text-blue-600 flex-shrink-0 mt-0.5" />
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
        <div key={tc.id} className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-teal-400 light:text-teal-600 bg-teal-500/10 light:bg-teal-50 border border-teal-500/20 light:border-teal-200 px-2 py-0.5 rounded">{tc.id}</span>
              {tc.fr_id && <span className="text-xs text-slate-500">covers {tc.fr_id}</span>}
              <span className="font-semibold text-sm text-slate-200 light:text-slate-800">{tc.title}</span>
            </div>
            <Badge value={tc.priority} />
          </div>
          {tc.preconditions && (
            <p className="text-xs text-slate-500 mb-3">
              <span className="font-semibold text-slate-600 light:text-slate-500">Preconditions: </span>{tc.preconditions}
            </p>
          )}
          <div className="mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Steps</p>
            <ol className="space-y-1">
              {tc.steps?.map((s: string, i: number) => (
                <li key={i} className="text-sm text-slate-300 light:text-slate-700 flex gap-2">
                  <span className="text-slate-600 light:text-slate-400 font-mono flex-shrink-0 w-5">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          {tc.expected_result && (
            <div className="bg-green-500/5 light:bg-green-50 border border-green-500/20 light:border-green-200 rounded-lg p-3">
              <p className="text-xs text-slate-500 font-semibold mb-1">Expected Result</p>
              <p className="text-sm text-green-300 light:text-green-700">{tc.expected_result}</p>
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
        <div key={tc.id} className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-orange-400 light:text-orange-600 bg-orange-500/10 light:bg-orange-50 border border-orange-500/20 light:border-orange-200 px-2 py-0.5 rounded">{tc.id}</span>
              {tc.sr_id && <span className="text-xs text-slate-500">covers {tc.sr_id}</span>}
              <span className="font-semibold text-sm text-slate-200">{tc.title}</span>
            </div>
            <Badge value={tc.severity} />
          </div>
          {tc.attack_vector && (
            <div className="bg-red-500/5 light:bg-red-50 border border-red-500/20 light:border-red-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-slate-500 font-semibold mb-1">Attack Vector</p>
              <p className="text-sm text-red-300 light:text-red-600">{tc.attack_vector}</p>
            </div>
          )}
          <div className="mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Steps</p>
            <ol className="space-y-1">
              {tc.steps?.map((s: string, i: number) => (
                <li key={i} className="text-sm text-slate-300 light:text-slate-700 flex gap-2">
                  <span className="text-slate-600 light:text-slate-400 font-mono flex-shrink-0 w-5">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          {tc.expected_result && (
            <div className="bg-green-500/5 light:bg-green-50 border border-green-500/20 light:border-green-200 rounded-lg p-3">
              <p className="text-xs text-slate-500 font-semibold mb-1">Expected (Secure) Result</p>
              <p className="text-sm text-green-300 light:text-green-700">{tc.expected_result}</p>
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
        <div key={sc.id} className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span className="text-xs font-mono text-pink-400 light:text-pink-600 bg-pink-500/10 light:bg-pink-50 border border-pink-500/20 light:border-pink-200 px-2 py-0.5 rounded">{sc.id}</span>
            <span className="font-bold text-slate-200 light:text-slate-800">{sc.name}</span>
            {sc.route && <span className="text-xs text-slate-500 font-mono bg-slate-800 light:bg-slate-100 light:text-slate-600 px-2 py-0.5 rounded">{sc.route}</span>}
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
                        <ArrowRight size={12} className="flex-shrink-0 mt-0.5" />
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
            <div key={label} className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-indigo-400 light:text-indigo-600">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 light:border-slate-200">
              <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 pr-4 w-24">FR ID</th>
              <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 pr-4">Title</th>
              <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 pr-4">Test Cases</th>
              <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3">Security Reqs</th>
            </tr>
          </thead>
          <tbody>
            {data.matrix?.map((row: any) => (
              <tr key={row.fr_id} className="border-b border-slate-800/50 light:border-slate-200 hover:bg-slate-800/30 light:hover:bg-slate-50 transition">
                <td className="py-3 pr-4">
                  <span className="text-xs font-mono text-indigo-400 light:text-indigo-600">{row.fr_id}</span>
                </td>
                <td className="py-3 pr-4 text-slate-300 light:text-slate-700">{row.fr_title}</td>
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

// ─── UML Diagrams (Mermaid) ──────────────────────────────────────────────────

let mermaidReady = false;

function MermaidDiagram({ code, uid }: { code: string; uid: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!mermaidReady) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            darkMode: true,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            flowchart: { htmlLabels: true, curve: "basis" },
          });
          mermaidReady = true;
        }
        const { svg } = await mermaid.render(`mermaid-${uid}`, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          const svgEl = ref.current.querySelector("svg");
          if (svgEl) {
            svgEl.removeAttribute("width");
            svgEl.removeAttribute("height");
            svgEl.style.display = "block";
            svgEl.style.width = "100%";
            svgEl.style.maxWidth = "680px";
            svgEl.style.margin = "0 auto";
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to render diagram");
      }
    }
    render();
    return () => { cancelled = true; };
  }, [code, uid]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2">
        <p className="text-xs text-red-400 font-semibold">Render error</p>
        <pre className="text-xs text-slate-400 overflow-auto whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }
  return <div ref={ref} className="flex justify-center [&_svg]:max-w-full" />;
}

const DIAGRAM_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  use_case:  { label: "Use Case",    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  class:     { label: "Class",       color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  sequence:  { label: "Sequence",    color: "text-teal-400 bg-teal-500/10 border-teal-500/20" },
  er:        { label: "ER",          color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  activity:  { label: "Activity",    color: "text-green-400 bg-green-500/10 border-green-500/20" },
  state:     { label: "State",       color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
  component: { label: "Component",   color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  deployment:{ label: "Deployment",  color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
};

function DiagramsView({ data }: { data: any }) {
  const [expanded, setExpanded] = useState<string | null>(data.diagrams?.[0]?.id ?? null);

  return (
    <div className="space-y-4">
      {data.diagrams?.map((d: any) => {
        const isOpen = expanded === d.id;
        const meta = DIAGRAM_TYPE_LABELS[d.type] ?? { label: d.type, color: "text-slate-400 bg-slate-800 border-slate-700" };
        return (
          <div key={d.id} className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : d.id)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-800/40 light:hover:bg-slate-50 transition text-left"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${meta.color}`}>{meta.label}</span>
                <span className="font-semibold text-slate-100 light:text-slate-800 text-sm">{d.title}</span>
                {d.description && <span className="text-xs text-slate-500 hidden sm:inline">— {d.description}</span>}
              </div>
              <ChevronDown size={14} className={`text-slate-500 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="border-t border-slate-800 light:border-slate-200 p-5 bg-slate-950/40 light:bg-slate-50">
                <MermaidDiagram code={d.mermaid} uid={d.id} />
                <details className="mt-4">
                  <summary className="text-xs text-slate-600 light:text-slate-400 cursor-pointer hover:text-slate-400 light:hover:text-slate-600 transition select-none">
                    View source
                  </summary>
                  <pre className="mt-2 text-xs text-slate-500 bg-slate-900 light:bg-slate-100 border border-slate-800 light:border-slate-200 rounded-lg p-3 overflow-auto whitespace-pre">
                    {d.mermaid}
                  </pre>
                </details>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── UI Code View ────────────────────────────────────────────────────────────

type Viewport = "desktop" | "tablet" | "mobile";
const VIEWPORT_WIDTH: Record<Viewport, number | string> = {
  desktop: "100%",
  tablet: 768,
  mobile: 390,
};
const VIEWPORT_ICONS: Record<Viewport, string> = {
  desktop: "⊞",
  tablet: "▭",
  mobile: "▯",
};

// ── Instant accent recolour (no AI call) ────────────────────────────────────
// Generated screens use Tailwind's `indigo-*` utility classes as their accent.
// We can remap the whole `indigo` scale live inside the preview iframe — two
// ways at once for robustness: (1) reconfigure the Tailwind Play CDN so every
// indigo utility/variant recompiles, and (2) a deterministic !important CSS
// fallback covering the common utilities in case the CDN doesn't re-run.
const ACCENT_PALETTES: Record<string, Record<number, string>> = {
  Indigo:  { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81" },
  Violet:  { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95" },
  Blue:    { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a" },
  Emerald: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b" },
  Teal:    { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 900: "#134e4a" },
  Rose:    { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337" },
  Amber:   { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f" },
};
const ACCENT_NAMES = Object.keys(ACCENT_PALETTES);

function accentInjection(accent: string): string {
  const pal = ACCENT_PALETTES[accent];
  if (!pal || accent === "Indigo") return ""; // Indigo is the original look
  // (1) Reconfigure the Play CDN — merges our indigo over the page's config and
  // reassigns tailwind.config, which triggers a recompile of every utility.
  const script = `<script>(function(){function go(){if(!window.tailwind){return setTimeout(go,15);}var c=window.tailwind.config||{};c.theme=c.theme||{};c.theme.extend=c.theme.extend||{};c.theme.extend.colors=Object.assign({},c.theme.extend.colors,{indigo:${JSON.stringify(pal)}});window.tailwind.config=c;}go();})();<\/script>`;
  // (2) Deterministic CSS fallback for the most common indigo utilities.
  let css = "";
  for (const [s, hex] of Object.entries(pal)) {
    css +=
      `.bg-indigo-${s}{background-color:${hex}!important}.hover\\:bg-indigo-${s}:hover{background-color:${hex}!important}.focus\\:bg-indigo-${s}:focus{background-color:${hex}!important}` +
      `.text-indigo-${s}{color:${hex}!important}.hover\\:text-indigo-${s}:hover{color:${hex}!important}.group:hover .group-hover\\:text-indigo-${s}{color:${hex}!important}` +
      `.border-indigo-${s}{border-color:${hex}!important}.hover\\:border-indigo-${s}:hover{border-color:${hex}!important}.focus\\:border-indigo-${s}:focus{border-color:${hex}!important}` +
      `.ring-indigo-${s}{--tw-ring-color:${hex}!important}.focus\\:ring-indigo-${s}:focus{--tw-ring-color:${hex}!important}` +
      `.from-indigo-${s}{--tw-gradient-from:${hex}!important;--tw-gradient-to:${hex}00!important;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)!important}.to-indigo-${s}{--tw-gradient-to:${hex}!important}.via-indigo-${s}{--tw-gradient-stops:var(--tw-gradient-from),${hex},var(--tw-gradient-to)!important}` +
      `.fill-indigo-${s}{fill:${hex}!important}.stroke-indigo-${s}{stroke:${hex}!important}.divide-indigo-${s}>:not([hidden])~:not([hidden]){border-color:${hex}!important}`;
  }
  return `${script}<style>${css}</style>`;
}

// In the preview iframe, the page's relative links (e.g. href="/tasks") resolve
// against our app's origin and would navigate the frame into our SPA. Inject a
// guard that neutralizes link navigation and form submits for the preview only,
// while leaving in-page (#) anchors and JS interactions (modals, tabs) working.
// `accent` optionally remaps the indigo accent scale live (no AI call).
function previewDoc(html: string, accent: string = "Indigo"): string {
  const guard = `<script>(function(){
    document.addEventListener('click',function(e){
      var a=e.target&&e.target.closest&&e.target.closest('a');
      if(a){var h=a.getAttribute('href')||'';if(h.charAt(0)!=='#'){e.preventDefault();}}
    },true);
    document.addEventListener('submit',function(e){e.preventDefault();},true);
  })();<\/script>`;
  let out = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, guard + "</body>") : html + guard;
  const accentTags = accentInjection(accent);
  if (accentTags) {
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, accentTags + "</head>") : accentTags + out;
  }
  return out;
}

function UICodeView({ data, pending, projectId, onRefreshed }: {
  data: any;
  pending?: any;
  projectId: string;
  onRefreshed: () => void | Promise<void>;
}) {
  // When a refinement is staged, preview the pending UI; otherwise the committed UI.
  const active = pending ?? data;
  const screens: any[] = active.screens ?? [];
  const [selected, setSelected] = useState<string | null>(screens[0]?.id ?? null);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [accent, setAccent] = useState<string>("Indigo"); // instant preview recolour, no AI
  const [copied, setCopied] = useState(false);

  // When a preview appears, jump to the first changed screen so the edit is visible.
  const changedIds: string[] = pending?.__refinement?.screensChanged ?? [];
  useEffect(() => {
    if (changedIds.length && !changedIds.includes(selected ?? "")) {
      setSelected(changedIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const screen = screens.find((s) => s.id === selected) ?? screens[0];

  function copyCode() {
    if (!screen?.html) return;
    navigator.clipboard.writeText(screen.html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadHTML() {
    if (!screen?.html) return;
    const blob = new Blob([screen.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${screen.id ?? screen.name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openInNewTab() {
    if (!screen?.html) return;
    const blob = new Blob([screen.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // revoke after a short delay so the browser has time to load it
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  if (!screens.length) {
    return <p className="text-slate-500 text-sm">No screens generated.</p>;
  }

  const iframeWidth = VIEWPORT_WIDTH[viewport];

  return (
    <div className="space-y-4">
      {/* Preview banner while changes are staged */}
      {pending && (
        <div className="flex items-center gap-2 text-xs text-indigo-300 light:text-indigo-700 bg-indigo-500/10 light:bg-indigo-50 border border-indigo-500/30 light:border-indigo-200 rounded-lg px-3 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
          Previewing proposed changes — not yet saved. Apply or discard below.
        </div>
      )}

      {/* Screen selector */}
      <div className="flex flex-wrap gap-2">
        {screens.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-medium transition border",
              selected === s.id
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-slate-700 light:border-slate-300 text-slate-400 light:text-slate-600 hover:border-indigo-500 hover:text-white light:hover:text-slate-900",
            ].join(" ")}
          >
            <span className="font-mono text-[10px] opacity-60 mr-1">{s.id}</span>
            {s.name}
          </button>
        ))}
      </div>

      {screen && (
        <div className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-2xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 light:border-slate-200 flex-wrap gap-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Preview / Code toggle */}
              <div className="flex items-center gap-0.5 bg-slate-800 light:bg-slate-100 rounded-lg p-0.5">
                {(["preview", "code"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition capitalize ${tab === t ? "bg-indigo-600 text-white" : "text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900"}`}>
                    {t === "preview" ? "Preview" : "HTML"}
                  </button>
                ))}
              </div>

              {/* Viewport size toggle (preview only) */}
              {tab === "preview" && (
                <div className="flex items-center gap-0.5 bg-slate-800 light:bg-slate-100 rounded-lg p-0.5">
                  {(["desktop", "tablet", "mobile"] as const).map((v) => (
                    <button key={v} onClick={() => setViewport(v)} title={v}
                      className={`px-2.5 py-1 rounded-md text-xs transition ${viewport === v ? "bg-slate-600 light:bg-slate-300 text-white light:text-slate-800" : "text-slate-500 hover:text-slate-300 light:hover:text-slate-700"}`}>
                      {VIEWPORT_ICONS[v]}
                    </button>
                  ))}
                </div>
              )}

              {/* Instant accent recolour (preview only, no AI call) */}
              {tab === "preview" && (
                <div className="flex items-center gap-1 bg-slate-800 light:bg-slate-100 rounded-lg px-1.5 py-1" title="Switch accent colour (preview only)">
                  {ACCENT_NAMES.map((name) => (
                    <button
                      key={name}
                      onClick={() => setAccent(name)}
                      title={`${name} accent`}
                      aria-label={`${name} accent`}
                      className={`w-4 h-4 rounded-full transition ${accent === name ? "ring-2 ring-offset-1 ring-offset-slate-800 light:ring-offset-slate-100 ring-white light:ring-slate-600" : "opacity-70 hover:opacity-100"}`}
                      style={{ background: ACCENT_PALETTES[name][500] }}
                    />
                  ))}
                </div>
              )}

              {screen.route && (
                <span className="text-xs text-slate-500 font-mono bg-slate-800 light:bg-slate-100 px-2 py-0.5 rounded">{screen.route}</span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              <button onClick={openInNewTab}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 light:border-slate-300 text-slate-400 light:text-slate-600 hover:border-indigo-500 hover:text-white light:hover:text-slate-900 transition">
                ↗ Open
              </button>
              <button onClick={downloadHTML}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 light:border-slate-300 text-slate-400 light:text-slate-600 hover:border-indigo-500 hover:text-white light:hover:text-slate-900 transition">
                ↓ .html
              </button>
              <button onClick={copyCode}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 light:border-slate-300 text-slate-400 light:text-slate-600 hover:border-indigo-500 hover:text-white light:hover:text-slate-900 transition">
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Content */}
          {tab === "preview" ? (
            <div className="bg-slate-200 light:bg-slate-100 flex justify-center overflow-auto" style={{ minHeight: 600, padding: 20 }}>
              {/* Browser-window frame around the generated screen */}
              <div
                className="flex flex-col rounded-xl overflow-hidden bg-white flex-shrink-0 border border-slate-300/70"
                style={{ width: iframeWidth, maxWidth: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.35)" }}
              >
                {/* Window chrome: traffic lights + address bar */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="w-3 h-3 rounded-full bg-yellow-400" />
                    <span className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 min-w-0 mx-1">
                    <div className="bg-white border border-slate-200 rounded-md px-3 py-1 text-[11px] text-slate-500 font-mono truncate text-center">
                      {screen.route ? `localhost${screen.route}` : screen.name}
                    </div>
                  </div>
                </div>
                <iframe
                  key={`${screen.id}-${viewport}-${accent}`}
                  srcDoc={previewDoc(screen.html, accent)}
                  sandbox="allow-scripts allow-same-origin"
                  title={screen.name}
                  onLoad={(e) => {
                    // Catch-all for programmatic navigation (e.g. window.location.href
                    // in the page's JS): if the frame loaded our app's origin, restore
                    // the preview instead of letting it route into our SPA.
                    const f = e.currentTarget;
                    try {
                      const href = f.contentWindow?.location?.href ?? "";
                      if (href.startsWith(window.location.origin)) {
                        f.srcdoc = previewDoc(screen.html, accent);
                      }
                    } catch {
                      /* cross-origin after nav → not our app, ignore */
                    }
                  }}
                  style={{ width: "100%", height: 600, border: 0, display: "block" }}
                />
              </div>
            </div>
          ) : (
            <pre className="overflow-auto p-5 text-xs text-slate-300 light:text-slate-700 font-mono leading-relaxed bg-slate-950 light:bg-slate-50 tab-size-2"
              style={{ maxHeight: 600 }}>
              <code>{screen.html}</code>
            </pre>
          )}
        </div>
      )}

      {/* Description + design system info */}
      <div className="flex items-start gap-4 text-xs text-slate-500 flex-wrap">
        {screen?.description && <span className="flex-1">{screen.description}</span>}
        {data.design_system && (
          <span className="flex-shrink-0 bg-slate-900 light:bg-slate-50 border border-slate-800 light:border-slate-200 rounded-lg px-3 py-1.5">
            Shared design system applied · {screens.length} screens
          </span>
        )}
      </div>

      {/* AI refinement controls — kept below the preview so the generated UI is
          front-and-centre; users drop down here only when they want to tweak it. */}
      <UIRefinementPanel
        projectId={projectId}
        screens={(data.screens ?? []).map((s: any) => ({ id: s.id, name: s.name, route: s.route }))}
        currentScreenId={selected}
        currentScreenName={screen?.name}
        pending={pending}
        onRefreshed={onRefreshed}
      />
    </div>
  );
}

// ─── IEEE 830 SRS Document View ─────────────────────────────────────────────

function SRSSection({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <div className="mb-10">
      <div className="flex items-baseline gap-3 pb-3 border-b-2 border-slate-800 light:border-slate-200 mb-6">
        <span className="text-slate-600 light:text-slate-400 font-mono text-base">{number}.</span>
        <h2 className="text-base font-bold text-white light:text-slate-900 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="space-y-8">{children}</div>
    </div>
  );
}

function SRSSubsection({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2.5 mb-3">
        <span className="text-slate-600 light:text-slate-400 font-mono text-sm flex-shrink-0">{number}</span>
        <h3 className="text-sm font-bold text-slate-300 light:text-slate-700">{title}</h3>
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}

function SRSDocumentView({ data, projectName }: { data: Record<string, any>; projectName?: string }) {
  const ext = data.extraction ?? {};
  const frs = data.functional_requirements?.requirements ?? [];
  const nfrs = data.non_functional_requirements?.requirements ?? [];
  const srs = data.security_requirements?.requirements ?? [];
  const nfrCats = [...new Set(nfrs.map((r: any) => r.category))] as string[];
  const today = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cover */}
      <div className="bg-slate-900 light:bg-white border border-slate-700 light:border-slate-200 rounded-2xl p-8 mb-10 text-center">
        <p className="text-xs text-indigo-400 light:text-indigo-600 uppercase tracking-widest font-semibold mb-3">Software Requirements Specification</p>
        <h1 className="text-2xl font-bold text-white light:text-slate-900 mb-2">{projectName ?? "Project"}</h1>
        <p className="text-slate-500 text-sm mb-1">IEEE Std 830-1998</p>
        <p className="text-slate-600 light:text-slate-400 text-xs">Generated {today}</p>
        <div className="mt-5 flex items-center justify-center gap-6 text-xs text-slate-600 light:text-slate-400">
          <span>{frs.length} Functional Req.</span>
          <span>·</span>
          <span>{nfrs.length} Non-Functional Req.</span>
          <span>·</span>
          <span>{srs.length} Security Req.</span>
        </div>
      </div>

      {/* Abstract */}
      {ext.abstract && (
        <div className="bg-slate-900/50 light:bg-slate-50 border border-slate-800 light:border-slate-200 rounded-xl p-6 mb-10">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Abstract</h2>
          <p className="text-slate-300 light:text-slate-700 text-sm leading-relaxed">{ext.abstract}</p>
        </div>
      )}

      {/* TOC */}
      <div className="bg-slate-900/50 light:bg-slate-50 border border-slate-800 light:border-slate-200 rounded-xl p-6 mb-10">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Table of Contents</h2>
        <div className="space-y-1.5 font-mono text-sm">
          {[
            ...(ext.abstract ? [{ n: "", label: "Abstract", indent: false }] : []),
            { n: "1.", label: "Introduction", indent: false },
            { n: "2.", label: "Overall Description", indent: false },
            { n: "3.", label: "Specific Requirements", indent: false },
            { n: "3.1", label: `Functional Requirements (${frs.length})`, indent: true },
            { n: "3.2", label: `Non-Functional Requirements (${nfrs.length})`, indent: true },
            { n: "3.3", label: `Security Requirements (${srs.length})`, indent: true },
          ].map(({ n, label, indent }) => (
            <div key={n} className={`flex gap-3 ${indent ? "pl-6 text-slate-500" : "text-slate-500 light:text-slate-600"}`}>
              <span className="text-slate-600 light:text-slate-400 w-8 flex-shrink-0">{n}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 1 */}
      <SRSSection number="1" title="Introduction">
        <SRSSubsection number="1.1" title="Purpose">
          <p className="text-slate-300 text-sm leading-relaxed">
            This Software Requirements Specification (SRS) describes the functional and non-functional requirements
            for <strong className="text-slate-100">{projectName ?? "the system"}</strong>. It is prepared in accordance
            with IEEE Std 830-1998 and serves as the authoritative reference for system design, development, and testing.
          </p>
        </SRSSubsection>
        {ext.motivation && (
          <SRSSubsection number="1.2" title="Motivation">
            <p className="text-slate-300 text-sm leading-relaxed">{ext.motivation}</p>
          </SRSSubsection>
        )}
        {ext.problem_statement && (
          <SRSSubsection number="1.3" title="Problem Statement">
            <p className="text-slate-300 text-sm leading-relaxed">{ext.problem_statement}</p>
          </SRSSubsection>
        )}
        <SRSSubsection number="1.4" title="Scope">
          <p className="text-slate-300 text-sm leading-relaxed">{ext.scope ?? ext.system_summary ?? "—"}</p>
        </SRSSubsection>
        {ext.objectives?.length > 0 && (
          <SRSSubsection number="1.5" title="Objectives">
            <ol className="space-y-2">
              {ext.objectives.map((o: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-slate-300">
                  <span className="text-slate-600 font-mono w-6 flex-shrink-0">{i + 1}.</span>
                  <span className="leading-relaxed">{o}</span>
                </li>
              ))}
            </ol>
          </SRSSubsection>
        )}
        <SRSSubsection number="1.6" title="Intended Users">
          <div className="flex flex-wrap gap-2">
            {(ext.actors ?? []).map((a: string) => (
              <span key={a} className="bg-slate-800 light:bg-slate-100 border border-slate-700 light:border-slate-200 text-slate-300 light:text-slate-700 text-xs px-3 py-1 rounded-full">{a}</span>
            ))}
          </div>
        </SRSSubsection>
        <SRSSubsection number="1.7" title="Document Conventions">
          <p className="text-slate-400 text-sm leading-relaxed">
            Requirements prefixed <code className="text-indigo-400 font-mono text-xs">FR-</code> are functional.
            Prefixed <code className="text-violet-400 font-mono text-xs">NFR-</code> are non-functional.
            Prefixed <code className="text-red-400 font-mono text-xs">SR-</code> are security requirements
            mapped to OWASP Top 10 (2021).
          </p>
        </SRSSubsection>
      </SRSSection>

      {/* Section 2 */}
      <SRSSection number="2" title="Overall Description">
        <SRSSubsection number="2.1" title="Product Perspective">
          <p className="text-slate-300 text-sm leading-relaxed">{ext.product_perspective ?? ext.system_summary ?? "—"}</p>
        </SRSSubsection>
        <SRSSubsection number="2.2" title="User Characteristics">
          <div className="flex flex-wrap gap-2">
            {(ext.actors ?? []).map((a: string) => (
              <span key={a} className="bg-slate-800 light:bg-slate-100 border border-slate-700 light:border-slate-200 text-slate-300 light:text-slate-700 text-xs px-3 py-1 rounded-full">{a}</span>
            ))}
          </div>
        </SRSSubsection>
        {ext.assumptions?.length > 0 && (
          <SRSSubsection number="2.3" title="Assumptions">
            <ul className="space-y-2">
              {ext.assumptions.map((a: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-slate-300">
                  <span className="text-slate-600 flex-shrink-0">•</span>
                  <span className="leading-relaxed">{a}</span>
                </li>
              ))}
            </ul>
          </SRSSubsection>
        )}
        {ext.constraints?.length > 0 && (
          <SRSSubsection number="2.4" title="Constraints">
            <ul className="space-y-2">
              {ext.constraints.map((c: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-slate-300">
                  <span className="text-slate-600 flex-shrink-0">•</span>
                  <span className="leading-relaxed">{c}</span>
                </li>
              ))}
            </ul>
          </SRSSubsection>
        )}
        <SRSSubsection number="2.5" title="Identified System Needs">
          <ol className="space-y-2">
            {(ext.extracted ?? []).map((req: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300">
                <span className="text-slate-600 font-mono w-6 flex-shrink-0">{i + 1}.</span>
                <span className="leading-relaxed">{req}</span>
              </li>
            ))}
          </ol>
        </SRSSubsection>
      </SRSSection>

      {/* Section 3 */}
      <SRSSection number="3" title="Specific Requirements">
        {/* 3.1 FR */}
        <SRSSubsection number="3.1" title={`Functional Requirements (${frs.length})`}>
          <div className="space-y-4 mt-1">
            {frs.map((r: any, i: number) => (
              <div key={r.id} className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-800/40 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <span className="text-xs text-slate-600 font-mono">3.1.{i + 1}</span>
                    <span className="text-xs font-mono text-indigo-400">{r.id}</span>
                    <span className="text-sm font-semibold text-slate-200">— {r.title}</span>
                  </div>
                  <Badge value={r.priority} />
                </div>
                <div className="px-4 py-3 space-y-3">
                  <p className="text-slate-300 text-sm leading-relaxed">{r.description}</p>
                  {r.acceptance_criteria?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">Acceptance Criteria</p>
                      <ul className="space-y-1">
                        {r.acceptance_criteria.map((c: string, ci: number) => (
                          <li key={ci} className="flex gap-2 text-sm text-slate-400">
                            <span className="text-green-500 flex-shrink-0">✓</span>{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SRSSubsection>

        {/* 3.2 NFR */}
        <SRSSubsection number="3.2" title={`Non-Functional Requirements (${nfrs.length})`}>
          <div className="space-y-6 mt-1">
            {nfrCats.map((cat, ci) => (
              <div key={cat}>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-xs text-slate-600 font-mono">3.2.{ci + 1}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cat}</span>
                </div>
                <div className="space-y-3 pl-6">
                  {nfrs.filter((r: any) => r.category === cat).map((r: any) => (
                    <div key={r.id} className="border border-slate-800 rounded-xl overflow-hidden">
                      <div className="bg-slate-800/40 px-4 py-2.5 flex items-center gap-2">
                        <span className="text-xs font-mono text-violet-400">{r.id}</span>
                        <span className="text-sm font-semibold text-slate-200">— {r.title}</span>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        <p className="text-slate-300 text-sm leading-relaxed">{r.description}</p>
                        {r.metric && (
                          <p className="text-xs text-green-300 font-mono bg-green-900/20 border border-green-800/30 rounded px-2 py-1 inline-block">
                            Metric: {r.metric}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SRSSubsection>

        {/* 3.3 SR */}
        <SRSSubsection number="3.3" title={`Security Requirements — OWASP Top 10 (${srs.length})`}>
          <div className="space-y-4 mt-1">
            {srs.map((r: any, i: number) => (
              <div key={r.id} className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-800/40 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <span className="text-xs text-slate-600 font-mono">3.3.{i + 1}</span>
                    <span className="text-xs font-mono text-red-400">{r.id}</span>
                    <span className="text-sm font-semibold text-slate-200">— {r.title}</span>
                  </div>
                  <Badge value={r.priority} />
                </div>
                {r.owasp_category && (
                  <div className="border-l-2 border-orange-500 mx-4 mt-3 pl-3 py-0.5">
                    <span className="text-xs text-orange-400">{r.owasp_category}</span>
                  </div>
                )}
                <div className="px-4 pb-3 pt-2 space-y-3">
                  <p className="text-slate-300 text-sm leading-relaxed">{r.description}</p>
                  {r.controls?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">Security Controls</p>
                      <ul className="space-y-1">
                        {r.controls.map((c: string, ci: number) => (
                          <li key={ci} className="flex gap-2 text-sm text-slate-400">
                            <ArrowRight size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SRSSubsection>
      </SRSSection>
    </div>
  );
}

// ─── Artifact count helper ───────────────────────────────────────────────────

function artifactCount(key: TabKey, content: any, artifactMap?: Record<string, any>): number | null {
  if (key === "srs_document") {
    if (!artifactMap) return null;
    const total = (artifactMap.functional_requirements?.requirements?.length ?? 0)
      + (artifactMap.non_functional_requirements?.requirements?.length ?? 0)
      + (artifactMap.security_requirements?.requirements?.length ?? 0);
    return total > 0 ? total : null;
  }
  if (!content) return null;
  switch (key) {
    case "extraction":                  return content.extracted?.length ?? null;
    case "functional_requirements":     return content.requirements?.length ?? null;
    case "non_functional_requirements": return content.requirements?.length ?? null;
    case "security_requirements":       return content.requirements?.length ?? null;
    case "functional_test_cases":       return content.test_cases?.length ?? null;
    case "security_test_cases":         return content.test_cases?.length ?? null;
    case "wireframes":                  return content.screens?.length ?? null;
    case "ui_code":                    return content.screens?.length ?? null;
    case "uml_diagrams":               return content.diagrams?.length ?? null;
    case "traceability_matrix":         return content.matrix?.length ?? null;
    default:                            return null;
  }
}

function ArtifactSummary({ tabKey, content, artifactMap }: { tabKey: TabKey; content: any; artifactMap: Record<string, any> }) {
  let text = "";
  if (tabKey === "srs_document") {
    const fr = artifactMap.functional_requirements?.requirements?.length ?? 0;
    const nfr = artifactMap.non_functional_requirements?.requirements?.length ?? 0;
    const sr = artifactMap.security_requirements?.requirements?.length ?? 0;
    text = `IEEE Std 830-1998 · ${fr} functional · ${nfr} non-functional · ${sr} security requirements`;
  } else {
    if (!content) return null;
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
      case "ui_code":
        text = `${content.screens?.length ?? 0} screens with generated HTML + Tailwind CSS`;
        break;
      case "uml_diagrams":
        text = `${content.diagrams?.length ?? 0} UML diagrams (Mermaid.js)`;
        break;
      case "traceability_matrix": {
        const cov = content.coverage;
        text = cov ? `${cov.covered_frs}/${cov.total_frs} FRs covered · ${cov.total_tcs} test cases · ${cov.percentage}% coverage` : "";
        break;
      }
    }
  }
  if (!text) return null;
  return (
    <div className="flex items-center gap-2 mb-5 text-xs text-slate-400 light:text-slate-600 bg-slate-900 light:bg-slate-50 border border-slate-800 light:border-slate-200 rounded-lg px-4 py-2.5">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
      {text}
    </div>
  );
}

// ─── Content dispatcher ──────────────────────────────────────────────────────

function ArtifactContent({ tabKey, content, artifactMap, projectName, projectId, onRefreshed }: {
  tabKey: TabKey;
  content: any;
  artifactMap: Record<string, any>;
  projectName?: string;
  projectId: string;
  onRefreshed: () => void | Promise<void>;
}) {
  if (tabKey === "srs_document") {
    return (
      <>
        <ArtifactSummary tabKey={tabKey} content={content} artifactMap={artifactMap} />
        <SRSDocumentView data={artifactMap} projectName={projectName} />
      </>
    );
  }
  if (!content) return <p className="text-slate-500 text-sm">No data available.</p>;
  return (
    <>
      <ArtifactSummary tabKey={tabKey} content={content} artifactMap={artifactMap} />
      {(() => {
        switch (tabKey) {
          case "extraction":                return <ExtractionView data={content} />;
          case "functional_requirements":   return <FRView data={content} />;
          case "non_functional_requirements": return <NFRView data={content} />;
          case "security_requirements":     return <SRView data={content} />;
          case "functional_test_cases":     return <FTCView data={content} />;
          case "security_test_cases":       return <STCView data={content} />;
          case "wireframes":                return <WireframesView data={content} />;
          case "ui_code":                  return <UICodeView data={content} pending={artifactMap["ui_code_pending"]} projectId={projectId} onRefreshed={onRefreshed} />;
          case "uml_diagrams":             return <DiagramsView data={content} />;
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
  const [diagramSvgsForExport, setDiagramSvgsForExport] = useState<Record<string, string>>({});
  const [generatingUI, setGeneratingUI] = useState(false);
  const [uiGenStage, setUiGenStage] = useState<string>("");
  const toast = useToast();

  async function refreshArtifacts() {
    if (id) setArtifacts(await fetchArtifacts(id));
  }

  async function handleExport(format: "pdf" | "docx" | "csv" | "latex") {
    if (!id || exporting) return;
    setExporting(format);
    try {
      let res: any;
      if (format === "pdf") {
        res = await api.post(`/projects/${id}/export/pdf`, { diagramSvgs: diagramSvgsForExport }, { responseType: "blob" });
      } else if (format === "latex") {
        // LaTeX exports as an Overleaf-ready .zip (main.tex + rendered figures).
        res = await api.post(`/projects/${id}/export/latex-zip`, { diagramSvgs: diagramSvgsForExport }, { responseType: "blob" });
      } else {
        res = await api.get(`/projects/${id}/export/${format}`, { responseType: "blob" });
      }
      const mime =
        format === "pdf"   ? "application/pdf" :
        format === "docx"  ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
        format === "latex" ? "application/zip" :
        "text/csv";
      const ext =
        format === "latex" ? "zip" :
        format === "pdf"   ? "pdf" :
        format;
      const suffix = format === "latex" ? "_latex" : "";
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.name ?? "project"}_req2ui${suffix}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${format === "latex" ? "LaTeX bundle" : format.toUpperCase()} downloaded.`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}.`);
    } finally {
      setExporting(null);
    }
  }

  function handleGenerateUI() {
    if (!id || generatingUI) return;
    setGeneratingUI(true);
    setUiGenStage("Starting…");

    const token = sessionStorage.getItem("access_token") ?? "";
    const base = import.meta.env.VITE_API_BASE_URL ?? "";
    const es = new EventSource(`${base}/api/projects/${id}/generate/ui-code?token=${token}`);

    es.addEventListener("stage", (e) => {
      const d = JSON.parse(e.data);
      setUiGenStage(d.status === "running" ? "Generating screens…" : d.status === "completed" ? "Done!" : d.name);
    });

    es.addEventListener("done", () => {
      es.close();
      setGeneratingUI(false);
      setUiGenStage("");
      // Refresh artifacts to show the new ui_code tab
      if (id) fetchArtifacts(id).then(setArtifacts);
      toast.success("UI code generated!");
    });

    es.addEventListener("error", (e: any) => {
      es.close();
      setGeneratingUI(false);
      setUiGenStage("");
      const msg = e.data ? JSON.parse(e.data)?.error : null;
      toast.error(msg ?? "UI code generation failed.");
    });

    es.onerror = () => {
      es.close();
      setGeneratingUI(false);
      setUiGenStage("");
      toast.error("Connection lost during UI generation.");
    };
  }

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchProject(id), fetchArtifacts(id)]).then(([p, arts]) => {
      setProject(p);
      setArtifacts(arts);
      if (arts.length > 0) {
        const srsKeys = ["extraction","functional_requirements","non_functional_requirements","security_requirements"];
        const hasSRS = srsKeys.every(k => arts.some(a => a.type === k));
        setActiveTab(hasSRS ? "srs_document" : arts[0].type as TabKey);
      }
      setLoading(false);
    });
  }, [id]);

  // Pre-render UML diagrams with neutral theme so PDF export can embed them
  useEffect(() => {
    const umlArtifact = artifacts.find((a) => a.type === "uml_diagrams");
    const diagrams = (umlArtifact?.content as any)?.diagrams;
    if (!diagrams?.length) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          fontFamily: "sans-serif",
          flowchart: { htmlLabels: false, curve: "basis" },
        });
        mermaidReady = false; // reset so display re-initialises with dark theme next render
        const svgs: Record<string, string> = {};
        for (const d of diagrams) {
          try {
            const { svg } = await mermaid.render(`pdf-export-${d.id}`, d.mermaid);
            svgs[d.id] = svg;
          } catch {
            // skip diagrams that fail to render
          }
        }
        if (!cancelled) setDiagramSvgsForExport(svgs);
      } catch {
        // mermaid import failure — export will proceed without images
      }
    })();
    return () => { cancelled = true; };
  }, [artifacts]);

  const artifactMap = Object.fromEntries(artifacts.map((a) => [a.type, a.content]));
  // `ui_code_pending` is a transient refinement preview, not a deliverable —
  // keep it in artifactMap (so UICodeView can render it) but exclude it from the
  // tab list and the "N / 10" count.
  const realArtifacts = artifacts.filter((a) => a.type !== "ui_code_pending");
  const availableKeys = new Set(realArtifacts.map((a) => a.type));
  const srsReady = ["extraction","functional_requirements","non_functional_requirements","security_requirements"]
    .every(k => availableKeys.has(k));

  if (loading) {
    return <LoadingScreen label="Loading artifacts" />;
  }

  return (
    <div className="min-h-screen bg-slate-950 light:bg-white text-white light:text-slate-900 transition-colors">
      {/* Header */}
      <header className="border-b border-slate-800 light:border-slate-200 bg-slate-900/60 light:bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link to="/" className="text-xl font-bold text-white light:text-slate-900 tracking-tight flex-shrink-0">
            Req<span className="text-indigo-400 light:text-indigo-600">2</span>UI
          </Link>
          <span className="text-slate-700 light:text-slate-300 text-lg font-light">/</span>
          <Link to="/dashboard" className="text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 transition text-sm flex items-center gap-1 flex-shrink-0">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <span className="text-slate-700 light:text-slate-300 text-lg font-light">/</span>
          <Link to={`/projects/${id}`} className="text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 transition text-sm truncate max-w-xs">
            {project?.name}
          </Link>
          <span className="text-slate-700 light:text-slate-300">/</span>
          <span className="text-slate-300 light:text-slate-700 text-sm font-medium">Artifacts</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-600 light:text-slate-400 mr-1">{realArtifacts.length} / 10</span>
            <ThemeToggle />
            {(["pdf", "docx", "csv", "latex"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                disabled={!!exporting || realArtifacts.length === 0}
                title={fmt === "latex" ? "Download an Overleaf-ready .zip (main.tex + rendered UML figures)" : `Export as ${fmt.toUpperCase()}`}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 light:border-slate-300 hover:border-indigo-500 light:hover:border-indigo-400 text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 transition disabled:opacity-40 disabled:cursor-not-allowed uppercase"
              >
                {exporting === fmt ? "…" : fmt}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-4 mb-8 scrollbar-none border-b border-slate-800 light:border-slate-200">
          {TABS.map((tab) => {
            const available =
              tab.key === "srs_document"
                ? srsReady
                : tab.key === "quality_report"
                // The quality report can be run as soon as the core SRS exists.
                ? srsReady
                : tab.key === "ui_code"
                // Enable once wireframes exist so the tab can be opened to
                // generate UI code, even before any ui_code artifact exists.
                ? availableKeys.has("ui_code") || availableKeys.has("wireframes")
                : availableKeys.has(tab.key);
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
                    ? "text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 hover:bg-slate-800 light:hover:bg-slate-100"
                    : "text-slate-700 light:text-slate-400 cursor-not-allowed",
                ].join(" ")}
              >
                <span className="hidden sm:inline">
                  {tab.label}
                  {(() => { const n = artifactCount(tab.key, artifactMap[tab.key], artifactMap); return n !== null ? <span className={`ml-1 text-xs ${active ? "text-indigo-200" : "text-slate-600"}`}>({n})</span> : null; })()}
                </span>
                <span className="sm:hidden">{tab.short}</span>
              </button>
            );
          })}
        </div>

        {/* UI Code generation prompt (when tab selected but artifact missing) */}
        {activeTab === "ui_code" && !availableKeys.has("ui_code") && availableKeys.has("wireframes") && (
          <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">⚡</div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 light:text-slate-900 mb-1">UI Code not yet generated</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                Generates standalone HTML + Tailwind pages for each wireframe screen using a two-pass AI pipeline (~60 seconds).
              </p>
            </div>
            {generatingUI ? (
              <div className="flex items-center gap-3 text-sm text-indigo-400">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                {uiGenStage || "Generating…"}
              </div>
            ) : (
              <button
                onClick={handleGenerateUI}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm shadow-lg shadow-indigo-900/30"
              >
                Generate UI Code
              </button>
            )}
          </div>
        )}

        {/* Regenerate control (when UI code already exists — re-runs Stage 10 only) */}
        {activeTab === "ui_code" && availableKeys.has("ui_code") && (
          <div className="flex justify-end mb-3">
            {generatingUI ? (
              <div className="flex items-center gap-2 text-sm text-indigo-400">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                {uiGenStage || "Regenerating…"}
              </div>
            ) : (
              <button
                onClick={handleGenerateUI}
                className="border border-line bg-surface/50 hover:bg-surface hover:border-indigo-500/60 text-muted hover:text-ink font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-1.5"
              >
                ↻ Regenerate UI Code
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {activeTab === "quality_report" ? (
          <QualityReport projectId={id ?? ""} />
        ) : (
          !(activeTab === "ui_code" && !availableKeys.has("ui_code") && availableKeys.has("wireframes")) && (
            <ArtifactContent
              tabKey={activeTab}
              content={artifactMap[activeTab]}
              artifactMap={artifactMap}
              projectName={project?.name}
              projectId={id ?? ""}
              onRefreshed={refreshArtifacts}
            />
          )
        )}
      </div>
    </div>
  );
}
