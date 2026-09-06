import { useEffect, useMemo, useState } from "react";
import KanbanColumn from "./KanbanColumn";
import ResumeUploadModal from "./ResumeUploadModal";
import { fetchJobs, updateJobStatus, deleteJob, getProfile, triggerJobFetch, getPipelineStatus } from "../api";

const COLUMNS = ["New", "Saved", "Applied", "Interview", "Offer", "Rejected"];

export default function JobBoard() {
  const [jobs, setJobs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [minFit, setMinFit] = useState(0);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [fetchingJobs, setFetchingJobs] = useState(false);
  const [pipelineMessage, setPipelineMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      const [jobsData, profileData] = await Promise.all([
        fetchJobs(),
        getProfile().catch(() => null)
      ]);
      setJobs(jobsData);
      if (profileData) setProfile(profileData);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleTriggerFetch() {
    try {
      setFetchingJobs(true);
      setPipelineMessage("Initiating job discovery & AI matching...");
      await triggerJobFetch();

      // Poll pipeline status until completed
      const interval = setInterval(async () => {
        try {
          const status = await getPipelineStatus();
          setPipelineMessage(status.message);
          if (!status.is_running) {
            clearInterval(interval);
            setFetchingJobs(false);
            load(); // Reload board with freshly ingested jobs
          }
        } catch {
          clearInterval(interval);
          setFetchingJobs(false);
        }
      }, 3000);
    } catch (err) {
      setPipelineMessage(err.message || "Failed to start fetch");
      setFetchingJobs(false);
    }
  }

  async function handleStatusChange(id, status) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
    await updateJobStatus(id, status);
  }

  async function handleDelete(id) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    await deleteJob(id);
  }

  const filtered = useMemo(
    () => jobs.filter((j) => j.fit_score === null || j.fit_score === undefined || j.fit_score >= minFit),
    [jobs, minFit]
  );

  const byStatus = (status) => filtered.filter((j) => j.status === status);

  return (
    <div className="min-h-screen bg-ink px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-text text-lg font-semibold">AI Job Tracker</h1>
            {profile && (
              <span className="text-xs bg-panel border border-border px-2 py-0.5 rounded text-signal font-mono">
                {profile.name}
              </span>
            )}
          </div>
          <p className="text-muted text-xs mt-0.5 font-mono">
            {jobs.length} tracked &middot; last refresh {new Date().toLocaleTimeString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Resume Upload Button */}
          <button
            onClick={() => setIsUploadOpen(true)}
            className="text-xs bg-panel text-text border border-border rounded px-3 py-1.5 hover:border-signal transition flex items-center gap-1.5"
          >
            <span>📄</span> Upload Resume
          </button>

          {/* On-demand Job Fetcher */}
          <button
            onClick={handleTriggerFetch}
            disabled={fetchingJobs}
            className="text-xs bg-signal text-black font-medium rounded px-3 py-1.5 hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5"
          >
            <span>✨</span> {fetchingJobs ? "Scoring Jobs..." : "Fetch New Jobs"}
          </button>

          <label className="text-muted text-xs flex items-center gap-2 ml-2">
            Min fit
            <input
              type="range"
              min="0"
              max="100"
              value={minFit}
              onChange={(e) => setMinFit(Number(e.target.value))}
              className="accent-signal"
            />
            <span className="font-mono text-text w-8">{minFit}</span>
          </label>

          <button
            onClick={load}
            className="text-xs text-cool border border-border rounded px-3 py-1.5 hover:border-cool"
          >
            Refresh
          </button>
        </div>
      </header>

      {pipelineMessage && (
        <div className="bg-panel border border-border text-cool text-xs rounded-lg px-4 py-2 mb-4 flex items-center justify-between font-mono animate-fade-in">
          <span>{pipelineMessage}</span>
          {fetchingJobs && <span className="animate-pulse">● In Progress</span>}
        </div>
      )}

      {error && (
        <div className="text-warn text-sm mb-4 font-mono">
          Couldn't reach the API: {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading&hellip;</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              title={status}
              jobs={byStatus(status)}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Resume Upload Modal */}
      <ResumeUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        currentProfile={profile}
        onUploadSuccess={(newProfile) => {
          setProfile(newProfile);
          load();
        }}
      />
    </div>
  );
}
