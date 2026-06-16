import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProject, fetchArtifacts } from "../api/projects";
import type { Project, Artifact } from "../types/project";
import api from "../api/axios";

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

function WireframesView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {data.screens?.map((sc: any) => (
        <div key={sc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded">{sc.id}</span>
            <span className="font-semibold text-slate-200">{sc.name}</span>
            {sc.route && <span className="text-xs text-slate-500 font-mono">{sc.route}</span>}
          </div>
          {sc.description && <p className="text-slate-400 text-sm leading-relaxed mb-4">{sc.description}</p>}
          {sc.components?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Components</p>
              <div className="grid grid-cols-1 gap-2">
                {sc.components.map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 bg-slate-800/50 rounded-lg px-3 py-2">
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono flex-shrink-0">{c.type}</span>
                    <div>
                      <span className="text-sm text-slate-200 font-medium">{c.label}</span>
                      {c.purpose && <p className="text-xs text-slate-500 mt-0.5">{c.purpose}</p>}
                    </div>
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
                  <li key={i} className="text-xs text-slate-400">{n}</li>
                ))}
              </ul>
            </div>
          )}
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

// ─── Content dispatcher ──────────────────────────────────────────────────────

function ArtifactContent({ tabKey, content }: { tabKey: TabKey; content: any }) {
  if (!content) return <p className="text-slate-500 text-sm">No data available.</p>;
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
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ArtifactsViewer() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("extraction");
  const [exporting, setExporting] = useState<string | null>(null);

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
                <span className="hidden sm:inline">{tab.label}</span>
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
