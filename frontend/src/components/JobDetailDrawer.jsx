import { useEffect } from "react";

function fitBadge(score) {
  if (score === null || score === undefined) return null;
  if (score >= 80) return { bg: "bg-signal/15 border-signal/40 text-signal", dot: "bg-signal" };
  if (score >= 60) return { bg: "bg-cool/15 border-cool/40 text-cool", dot: "bg-cool" };
  return { bg: "bg-warn/15 border-warn/40 text-warn", dot: "bg-warn" };
}

function formatSalary(min, max) {
  if (!min && !max) return null;
  const fmt = (n) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max)}`;
}

function getFreshness(isoString) {
  if (!isoString) return null;
  const then = new Date(isoString);
  if (isNaN(then)) return null;
  const diffHrs = (Date.now() - then.getTime()) / 3600000;
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`;
  if (diffHrs < 48) return "Yesterday";
  return `${Math.round(diffHrs / 24)}d ago`;
}

function isRemote(location = "") {
  const loc = location.toLowerCase();
  return loc.includes("remote") || loc.includes("distributed") || loc.includes("anywhere");
}

export default function JobDetailDrawer({ job, onClose, onDraftPitch }) {
  // Close on ESC
  useEffect(() => {
    if (!job) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [job, onClose]);

  if (!job) return null;

  const badge = fitBadge(job.fit_score);
  const salary = formatSalary(job.salary_min, job.salary_max);
  const freshness = getFreshness(job.posted_at);
  const remote = isRemote(job.location);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer panel — slides in from the right */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl flex flex-col bg-surface border-l border-border shadow-2xl animate-slide-in-right">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border/80 bg-surface2/60 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-text font-semibold text-base leading-snug">
                {job.title}
              </h2>
              {badge && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border shrink-0 ${badge.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                  {job.fit_score}% Match
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-sm text-cool font-medium">{job.company}</span>

              {job.location && (
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-medium ${
                  remote ? "bg-signal/10 border-signal/30 text-signal" : "bg-ink border-border text-muted"
                }`}>
                  {remote ? "🌐" : "📍"} {job.location}
                </span>
              )}

              {salary && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-mono bg-violet-500/10 border-violet-500/30 text-violet-300">
                  💰 {salary}
                </span>
              )}

              {freshness && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-mono bg-ink border-border text-muted/80">
                  {freshness}
                </span>
              )}

              {job.source && (
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-ink border border-border/80 rounded text-muted/60">
                  {job.source.replace("greenhouse:", "")}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 text-muted hover:text-text p-1.5 rounded-lg hover:bg-surface2 transition text-sm"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* AI Fit Analysis — full, untruncated */}
          {job.fit_reason && (
            <section>
              <p className="text-[11px] font-mono text-signal/80 font-semibold uppercase tracking-wider mb-2">
                ✦ AI Fit Analysis
              </p>
              <div className="bg-ink/70 border border-signal/20 rounded-xl p-4 text-sm text-text/90 leading-relaxed">
                {job.fit_reason}
              </div>
            </section>
          )}

          {/* Full Job Description */}
          {job.description ? (
            <section>
              <p className="text-[11px] font-mono text-muted font-semibold uppercase tracking-wider mb-2">
                📋 Job Description
              </p>
              <div className="bg-ink/40 border border-border rounded-xl p-4 text-sm text-text/80 leading-relaxed whitespace-pre-wrap font-sans">
                {job.description}
              </div>
            </section>
          ) : (
            <div className="bg-ink/40 border border-border border-dashed rounded-xl p-6 text-center text-muted text-xs font-mono">
              No description available — open the original posting to read more.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 px-6 py-4 border-t border-border/80 bg-surface2/40 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted font-mono">
            {job.status && (
              <span className="inline-flex items-center gap-1">
                Status: <span className="text-cool font-semibold">{job.status}</span>
              </span>
            )}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { onDraftPitch(job); onClose(); }}
              className="inline-flex items-center gap-1.5 text-xs bg-signal/15 hover:bg-signal/25 border border-signal/40 text-signal rounded-lg px-3 py-1.5 font-medium transition"
            >
              ✨ Draft Pitch
            </button>

            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-cool hover:bg-cool/90 text-black font-semibold rounded-lg px-4 py-1.5 transition shadow-sm"
              >
                Apply Now ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
