const STATUSES = ["New", "Saved", "Applied", "Interview", "Offer", "Rejected"];

function fitColor(score) {
  if (score === null || score === undefined) return "text-muted";
  if (score >= 75) return "text-signal";
  if (score >= 50) return "text-warn";
  return "text-muted";
}

function timeAgo(isoString) {
  if (!isoString) return "";
  const then = new Date(isoString);
  if (isNaN(then)) return "";
  const diffHrs = Math.round((Date.now() - then.getTime()) / 3600000);
  if (diffHrs < 1) return "just now";
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.round(diffHrs / 24)}d ago`;
}

export default function JobCard({ job, onStatusChange, onDelete }) {
  return (
    <div className="bg-surface border border-border rounded-md p-3 flex flex-col gap-2 hover:border-cool/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-text font-medium text-sm leading-snug truncate">{job.title}</p>
          <p className="text-muted text-xs mt-0.5 truncate">{job.company}</p>
        </div>
        {job.fit_score !== null && job.fit_score !== undefined && (
          <span className={`font-mono text-xs shrink-0 ${fitColor(job.fit_score)}`}>
            {job.fit_score}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted font-mono">
        {job.location && <span className="truncate">{job.location}</span>}
        {job.posted_at && (
          <>
            <span className="opacity-40">/</span>
            <span>{timeAgo(job.posted_at)}</span>
          </>
        )}
      </div>

      {job.fit_reason && (
        <p className="text-muted text-xs leading-snug line-clamp-2">{job.fit_reason}</p>
      )}

      <div className="flex items-center justify-between pt-1 gap-2">
        <select
          value={job.status}
          onChange={(e) => onStatusChange(job.id, e.target.value)}
          className="bg-surface2 text-text text-xs rounded border border-border px-1.5 py-1 focus:outline-none focus:border-cool"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-3">
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="text-cool text-xs hover:underline"
            >
              Open
            </a>
          )}
          <button
            onClick={() => onDelete(job.id)}
            className="text-muted text-xs hover:text-warn"
            aria-label="Remove job"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
