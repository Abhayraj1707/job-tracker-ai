const FUNNEL = ["New", "Saved", "Applied", "Interview", "Offer", "Rejected"];

const FUNNEL_COLORS = {
  New:       "text-muted",
  Saved:     "text-cool",
  Applied:   "text-signal",
  Interview: "text-violet-400",
  Offer:     "text-emerald-400",
  Rejected:  "text-warn",
};

export default function StatsBar({ jobs }) {
  if (!jobs || jobs.length === 0) return null;

  // Funnel counts
  const byStatus = {};
  FUNNEL.forEach((s) => (byStatus[s] = 0));
  jobs.forEach((j) => {
    if (byStatus[j.status] !== undefined) byStatus[j.status]++;
  });

  // Response rate: interviews / applied (avoid div by zero)
  const applied = byStatus["Applied"] + byStatus["Interview"] + byStatus["Offer"] + byStatus["Rejected"];
  const responseRate = applied > 0 ? Math.round(((byStatus["Interview"] + byStatus["Offer"]) / applied) * 100) : null;

  // Avg fit score
  const scored = jobs.filter((j) => j.fit_score != null);
  const avgFit = scored.length > 0 ? Math.round(scored.reduce((s, j) => s + j.fit_score, 0) / scored.length) : null;

  // Top 3 sources
  const sourceCounts = {};
  jobs.forEach((j) => {
    const src = (j.source || "unknown").replace("greenhouse:", "").replace("lever:", "");
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="border-b border-border/60 bg-surface/30 px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-6 gap-y-2">

        {/* Funnel pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FUNNEL.map((status, i) => (
            <span key={status} className="flex items-center gap-1">
              <span className={`text-[11px] font-mono font-semibold ${FUNNEL_COLORS[status]}`}>
                {byStatus[status]}
              </span>
              <span className="text-[11px] text-muted">{status}</span>
              {i < FUNNEL.length - 1 && (
                <span className="text-muted/30 text-[10px] ml-1">›</span>
              )}
            </span>
          ))}
        </div>

        {/* Divider */}
        <span className="hidden sm:block w-px h-4 bg-border/60" />

        {/* Response rate */}
        {responseRate !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted">Response rate</span>
            <span className={`text-[11px] font-mono font-semibold ${responseRate >= 20 ? "text-emerald-400" : responseRate >= 10 ? "text-signal" : "text-warn"}`}>
              {responseRate}%
            </span>
          </div>
        )}

        {/* Avg fit score */}
        {avgFit !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted">Avg match</span>
            <span className={`text-[11px] font-mono font-semibold ${avgFit >= 70 ? "text-signal" : avgFit >= 50 ? "text-cool" : "text-warn"}`}>
              {avgFit}%
            </span>
          </div>
        )}

        {/* Divider */}
        <span className="hidden sm:block w-px h-4 bg-border/60" />

        {/* Top sources */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">Sources</span>
          {topSources.map(([src, count]) => (
            <span key={src} className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 bg-ink border border-border/80 rounded text-muted/80">
              {src}
              <span className="text-signal/80 font-semibold">{count}</span>
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
