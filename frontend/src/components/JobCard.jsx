const STATUSES = ["New", "Saved", "Applied", "Interview", "Offer", "Rejected"];

function fitBadge(score) {
  if (score === null || score === undefined) return null;
  if (score >= 80) {
    return {
      bg: "bg-signal/15 border-signal/40 text-signal",
      label: `${score}% Match`,
      dot: "bg-signal",
    };
  }
  if (score >= 60) {
    return {
      bg: "bg-cool/15 border-cool/40 text-cool",
      label: `${score}% Match`,
      dot: "bg-cool",
    };
  }
  return {
    bg: "bg-warn/15 border-warn/40 text-warn",
    label: `${score}% Match`,
    dot: "bg-warn",
  };
}

function getFreshness(isoString) {
  if (!isoString) return { text: "", isRecent: false };
  const then = new Date(isoString);
  if (isNaN(then)) return { text: "", isRecent: false };
  const diffHrs = (Date.now() - then.getTime()) / 3600000;

  if (diffHrs < 1) return { text: "Just now", isRecent: true };
  if (diffHrs < 24) return { text: `${Math.round(diffHrs)}h ago`, isRecent: true };
  if (diffHrs < 48) return { text: "Yesterday", isRecent: false };
  const days = Math.round(diffHrs / 24);
  return { text: `${days}d ago`, isRecent: false };
}

function isRemote(location = "") {
  const loc = location.toLowerCase();
  return loc.includes("remote") || loc.includes("distributed") || loc.includes("anywhere");
}

export default function JobCard({ job, onStatusChange, onDelete, onDraftPitch }) {
  const badge = fitBadge(job.fit_score);
  const freshness = getFreshness(job.posted_at);
  const remote = isRemote(job.location);

  return (
    <div className="group bg-surface hover:bg-surface2/80 border border-border hover:border-cool/40 rounded-xl p-3.5 flex flex-col gap-2.5 transition-all duration-150 shadow-sm hover:shadow-md relative">
      {/* Header: Title, Company, Match Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-text font-medium text-sm leading-snug line-clamp-2 group-hover:text-cool transition-colors">
            {job.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted font-medium">
            <span className="truncate">{job.company}</span>
            {job.source && (
              <>
                <span className="opacity-30">•</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-ink border border-border/80 rounded text-muted/80">
                  {job.source.replace("greenhouse:", "")}
                </span>
              </>
            )}
          </div>
        </div>

        {badge && (
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border ${badge.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
            {badge.label}
          </span>
        )}
      </div>

      {/* Location & Freshness metadata tags */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {job.location && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${
              remote
                ? "bg-signal/10 border-signal/30 text-signal"
                : "bg-ink border-border text-muted"
            }`}
          >
            <span>{remote ? "🌐" : "📍"}</span>
            <span className="truncate max-w-[140px]">{job.location}</span>
          </span>
        )}

        {freshness.text && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono ${
              freshness.isRecent
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold"
                : "bg-ink border-border text-muted/80"
            }`}
          >
            {freshness.isRecent && <span>🔥</span>}
            <span>{freshness.text}</span>
          </span>
        )}
      </div>

      {/* AI Fit Reason */}
      {job.fit_reason && (
        <div className="bg-ink/60 border border-border/70 rounded-lg p-2 text-xs text-muted/90 leading-relaxed font-sans">
          <p className="line-clamp-2 text-[11px]">
            <span className="text-signal/90 font-mono mr-1">✦ AI Fit:</span>
            {job.fit_reason}
          </p>
        </div>
      )}

      {/* Footer Controls: Status Dropdown & Action Links */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50 gap-2">
        <select
          value={job.status}
          onChange={(e) => onStatusChange(job.id, e.target.value)}
          className="bg-ink hover:bg-surface2 text-text text-xs rounded-md border border-border px-2 py-1 focus:outline-none focus:border-cool font-medium cursor-pointer transition"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          {/* 1-Click AI Pitch Button */}
          <button
            onClick={() => onDraftPitch && onDraftPitch(job)}
            className="inline-flex items-center gap-1 text-xs bg-signal/15 hover:bg-signal/25 border border-signal/40 text-signal rounded-md px-2.5 py-1 font-medium transition shadow-xs"
            title="Generate AI Cover Letter & LinkedIn outreach note"
          >
            <span>✨</span>
            <span>Pitch</span>
          </button>

          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs bg-cool/10 hover:bg-cool/20 border border-cool/30 text-cool rounded-md px-2.5 py-1 font-medium transition"
            >
              <span>Apply</span>
              <span className="text-[10px]">↗</span>
            </a>
          )}
          <button
            onClick={() => onDelete(job.id)}
            className="text-muted/60 hover:text-warn text-xs p-1 rounded hover:bg-warn/10 transition"
            title="Remove from board"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
