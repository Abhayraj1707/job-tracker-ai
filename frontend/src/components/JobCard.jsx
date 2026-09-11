import { useState, useRef, useEffect } from "react";
import { updateJobNotes, updateFollowUpDate } from "../api";

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

function formatSalary(min, max) {
  if (!min && !max) return null;
  const fmt = (n) => {
    if (n >= 100000) return `$${(n / 1000).toFixed(0)}k`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
    return `$${n}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max)}`;
}

export default function JobCard({ job, onStatusChange, onDelete, onDraftPitch, selectMode, isSelected, onToggleSelect }) {
  const badge = fitBadge(job.fit_score);
  const freshness = getFreshness(job.posted_at);
  const remote = isRemote(job.location);
  const salary = formatSalary(job.salary_min, job.salary_max);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(job.notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(job.follow_up_date || "");
  const saveTimer = useRef(null);
  const textareaRef = useRef(null);

  // Auto-focus textarea when notes panel opens
  useEffect(() => {
    if (notesOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [notesOpen]);

  // Debounced auto-save: save 1s after user stops typing
  function handleNotesChange(e) {
    const val = e.target.value;
    setNotes(val);
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateJobNotes(job.id, val);
        setSaved(true);
      } finally {
        setSaving(false);
      }
    }, 1000);
  }

  async function handleFollowUpChange(e) {
    const val = e.target.value;
    setFollowUpDate(val);
    await updateFollowUpDate(job.id, val || null);
  }

  // Follow-up badge info
  function getFollowUpBadge() {
    if (!followUpDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(followUpDate + "T00:00:00");
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)}d`, cls: "bg-red-500/15 border-red-500/40 text-red-400" };
    if (diffDays === 0) return { label: "Follow up today!", cls: "bg-amber-500/15 border-amber-500/40 text-amber-300" };
    if (diffDays <= 3) return { label: `Follow up in ${diffDays}d`, cls: "bg-amber-500/10 border-amber-500/30 text-amber-300" };
    return { label: `Follow up ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, cls: "bg-signal/10 border-signal/30 text-signal" };
  }

  const followUpBadge = getFollowUpBadge();

  return (
    <div
      onClick={selectMode ? () => onToggleSelect(job.id) : undefined}
      className={`group bg-surface hover:bg-surface2/80 border rounded-xl p-3.5 flex flex-col gap-2.5 transition-all duration-150 shadow-sm hover:shadow-md relative
        ${selectMode ? "cursor-pointer" : ""}
        ${isSelected ? "border-signal/60 bg-signal/5" : "border-border hover:border-cool/40"}
      `}
    >
      {/* Checkbox in select mode, remove button otherwise */}
      {selectMode ? (
        <div className={`absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] font-bold transition
          ${isSelected ? "bg-signal border-signal text-black" : "border-muted/50 bg-ink"}`}
        >
          {isSelected && "✓"}
        </div>
      ) : (
        <button
          onClick={() => onDelete(job.id)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted/60 hover:text-warn hover:bg-warn/10 text-xs w-5 h-5 rounded flex items-center justify-center transition"
          title="Remove from board"
        >
          ✕
        </button>
      )}

      {/* Header: Title, Company, Match Badge */}
      <div className="flex items-start justify-between gap-2 pr-4">
        <div className="min-w-0 flex-1">
          <p className="text-text font-medium text-sm leading-snug line-clamp-2 group-hover:text-cool transition-colors">
            {job.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted font-medium">
            <span className="truncate">{job.company}</span>
            {job.source && (
              <>
                <span className="opacity-30">•</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-ink border border-border/80 rounded text-muted/80">
                  {job.source.replace("greenhouse:", "")}
                </span>
              </>
            )}
          </div>
        </div>

        {badge && (
          <span
            className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border ${badge.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
            {badge.label}
          </span>
        )}
      </div>

      {/* Location, Freshness, Salary metadata tags */}
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

        {/* Salary badge — only shown when data exists */}
        {salary && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono bg-violet-500/10 border-violet-500/30 text-violet-300">
            <span>💰</span>
            <span>{salary}</span>
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

      {/* Notes panel — expands inline */}
      {notesOpen && (
        <div className="flex flex-col gap-1.5">
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={handleNotesChange}
            placeholder="Add your notes — recruiter name, interview prep, follow-up date..."
            rows={3}
            className="w-full bg-ink border border-border focus:border-cool rounded-lg px-2.5 py-2 text-[11px] text-text placeholder:text-muted/50 resize-none focus:outline-none transition"
          />
          <span className="text-[10px] font-mono text-muted/60 text-right h-3">
            {saving ? "Saving..." : saved ? "✓ Saved" : ""}
          </span>
          {/* Follow-up date picker — inside notes panel */}
          <div className="flex items-center gap-2 mt-0.5">
            <label className="text-[10px] text-muted font-mono shrink-0">🔔 Follow up by</label>
            <input
              type="date"
              value={followUpDate}
              onChange={handleFollowUpChange}
              className="bg-ink border border-border focus:border-cool rounded px-2 py-0.5 text-[11px] text-text focus:outline-none transition"
            />
            {followUpDate && (
              <button
                onClick={() => handleFollowUpChange({ target: { value: "" } })}
                className="text-[10px] text-muted/60 hover:text-warn transition"
                title="Clear date"
              >✕</button>
            )}
          </div>
        </div>
      )}

      {/* Notes indicator + follow-up badge when notes panel is closed */}
      {!notesOpen && (
        <div className="flex flex-wrap items-center gap-1.5">
          {notes && (
            <div className="flex items-center gap-1 text-[10px] text-muted/70 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cool/60"></span>
              <span className="truncate italic">{notes.split("\n")[0].slice(0, 60)}{notes.length > 60 ? "…" : ""}</span>
            </div>
          )}
          {followUpBadge && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${followUpBadge.cls}`}>
              🔔 {followUpBadge.label}
            </span>
          )}
        </div>
      )}

      {/* Footer Controls — status on its own row, actions below */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/50">
        <select
          value={job.status}
          onChange={(e) => onStatusChange(job.id, e.target.value)}
          className="w-full bg-ink hover:bg-surface2 text-text text-xs rounded-md border border-border px-2 py-1 focus:outline-none focus:border-cool font-medium cursor-pointer transition"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          {/* Notes toggle */}
          <button
            onClick={() => setNotesOpen((o) => !o)}
            className={`inline-flex items-center gap-1 text-xs rounded-md px-2 py-1 font-medium transition border ${
              notesOpen || notes
                ? "bg-cool/15 border-cool/40 text-cool"
                : "bg-surface2 border-border text-muted hover:text-text hover:border-border/80"
            }`}
          >
            <span>📝</span>
            <span>{notesOpen ? "✕" : "Notes"}</span>
          </button>

          {/* AI Pitch */}
          <button
            onClick={() => onDraftPitch && onDraftPitch(job)}
            className="inline-flex items-center gap-1 text-xs bg-signal/15 hover:bg-signal/25 border border-signal/40 text-signal rounded-md px-2 py-1 font-medium transition"
          >
            <span>✨</span>
            <span>Pitch</span>
          </button>

          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs bg-cool/10 hover:bg-cool/20 border border-cool/30 text-cool rounded-md px-2 py-1 font-medium transition"
            >
              Apply ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
