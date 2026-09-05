import { useEffect, useMemo, useState } from "react";
import KanbanColumn from "./KanbanColumn";
import { fetchJobs, updateJobStatus, deleteJob } from "../api";

const COLUMNS = ["New", "Saved", "Applied", "Interview", "Offer", "Rejected"];

export default function JobBoard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [minFit, setMinFit] = useState(0);

  async function load() {
    try {
      setLoading(true);
      const data = await fetchJobs();
      setJobs(data);
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
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-text text-lg font-semibold">Job Tracker</h1>
          <p className="text-muted text-xs mt-0.5 font-mono">
            {jobs.length} tracked &middot; last refresh {new Date().toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-muted text-xs flex items-center gap-2">
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
    </div>
  );
}
