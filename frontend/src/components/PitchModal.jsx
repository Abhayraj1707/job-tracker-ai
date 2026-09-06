import { useState, useEffect } from "react";
import { generatePitch } from "../api";

export default function PitchModal({ isOpen, onClose, job, candidateProfile }) {
  const [loading, setLoading] = useState(false);
  const [pitchData, setPitchData] = useState(null);
  const [activeTab, setActiveTab] = useState("cover_letter"); // "cover_letter" | "linkedin"
  const [copied, setCopied] = useState(false);
  const [tone, setTone] = useState("enthusiastic");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && job) {
      loadPitch(tone);
    } else {
      setPitchData(null);
      setCopied(false);
      setError(null);
    }
  }, [isOpen, job]);

  async function loadPitch(selectedTone) {
    if (!job) return;
    try {
      setLoading(true);
      setError(null);
      const data = await generatePitch(job, selectedTone);
      setPitchData(data);
    } catch (err) {
      setError(err.message || "Failed to generate pitch");
    } finally {
      setLoading(false);
    }
  }

  function handleToneChange(newTone) {
    setTone(newTone);
    loadPitch(newTone);
  }

  function handleCopy() {
    if (!pitchData) return;
    const textToCopy =
      activeTab === "cover_letter"
        ? pitchData.cover_letter
        : pitchData.linkedin_note;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border/80 flex items-start justify-between gap-3 bg-surface2/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text">✨ AI Application Pitch</span>
              <span className="text-[11px] bg-signal/15 border border-signal/30 text-signal px-2 py-0.5 rounded-full font-mono">
                {job.fit_score ? `${job.fit_score}% Match` : "Tailored"}
              </span>
            </div>
            <p className="text-xs text-muted mt-1">
              Applying for <span className="text-text font-medium">{job.title}</span> at{" "}
              <span className="text-cool font-medium">{job.company}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text text-sm p-1.5 rounded-lg hover:bg-surface2 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab & Tone Controls */}
        <div className="px-6 py-3 border-b border-border/60 bg-ink/50 flex flex-wrap items-center justify-between gap-3">
          {/* Format Tabs */}
          <div className="flex items-center bg-surface2 border border-border rounded-lg p-0.5 text-xs font-medium">
            <button
              onClick={() => setActiveTab("cover_letter")}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === "cover_letter"
                  ? "bg-ink text-signal border border-signal/30 shadow-xs font-semibold"
                  : "text-muted hover:text-text"
              }`}
            >
              📄 3-Paragraph Cover Letter
            </button>
            <button
              onClick={() => setActiveTab("linkedin")}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === "linkedin"
                  ? "bg-ink text-cool border border-cool/30 shadow-xs font-semibold"
                  : "text-muted hover:text-text"
              }`}
            >
              💬 LinkedIn / Cold Email Note
            </button>
          </div>

          {/* Tone Selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Tone:</span>
            <select
              value={tone}
              onChange={(e) => handleToneChange(e.target.value)}
              disabled={loading}
              className="bg-surface2 border border-border text-text rounded-md px-2 py-1 text-xs focus:outline-none focus:border-cool font-medium cursor-pointer"
            >
              <option value="enthusiastic">Enthusiastic & High-Energy</option>
              <option value="concise">Concise & Direct</option>
              <option value="leadership">Senior & Impact-Driven</option>
            </select>
          </div>
        </div>

        {/* Pitch Content Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* Key Qualifications Highlight */}
          {pitchData?.key_highlights && pitchData.key_highlights.length > 0 && (
            <div className="bg-panel border border-border/70 rounded-xl p-3.5 text-xs">
              <p className="text-signal font-mono font-medium mb-1.5 flex items-center gap-1.5">
                <span>🎯</span> Top Matching Strengths from your CV:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted/90 font-sans">
                {pitchData.key_highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="text-warn bg-warn/10 border border-warn/30 text-xs rounded-xl p-3 font-mono">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-6 h-6 border-2 border-signal border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-muted font-mono animate-pulse">
                Synthesizing your resume skills with {job.company}'s requirements...
              </p>
            </div>
          ) : pitchData ? (
            <div className="relative group">
              <div className="bg-ink/90 border border-border rounded-xl p-5 text-sm text-text/90 leading-relaxed font-sans whitespace-pre-wrap selection:bg-signal/30">
                {activeTab === "cover_letter"
                  ? pitchData.cover_letter
                  : pitchData.linkedin_note}
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-surface2/40 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted font-mono">
            {activeTab === "cover_letter" ? "Ready for job applications & portals" : "Ideal for recruiter DMs on LinkedIn"}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadPitch(tone)}
              disabled={loading}
              className="px-3 py-1.5 text-xs text-muted hover:text-text border border-border rounded-lg hover:bg-surface2 transition"
            >
              🔄 Regenerate
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || !pitchData}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                copied
                  ? "bg-signal text-black"
                  : "bg-cool hover:bg-cool/90 text-black shadow-sm"
              }`}
            >
              <span>{copied ? "✓" : "📋"}</span>
              <span>{copied ? "Copied to Clipboard!" : "Copy to Clipboard"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
