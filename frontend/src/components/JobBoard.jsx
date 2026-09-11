import { useEffect, useMemo, useState } from "react";
import KanbanColumn from "./KanbanColumn";
import StatsBar from "./StatsBar";
import ResumeUploadModal from "./ResumeUploadModal";
import AddJobModal from "./AddJobModal";
import PitchModal from "./PitchModal";
import { fetchJobs, updateJobStatus, deleteJob, getProfile, triggerJobFetch, getPipelineStatus } from "../api";

const COLUMNS = ["New", "Saved", "Applied", "Interview", "Offer", "Rejected"];

export default function JobBoard() {
  const [jobs, setJobs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters & Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [minFit, setMinFit] = useState(0);
  const [freshnessFilter, setFreshnessFilter] = useState("all"); // "all", "24h", "3d", "7d"
  const [workplaceFilter, setWorkplaceFilter] = useState("all"); // "all", "remote", "india"
  
  // Actions state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [selectedPitchJob, setSelectedPitchJob] = useState(null);
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

      const interval = setInterval(async () => {
        try {
          const status = await getPipelineStatus();
          setPipelineMessage(status.message);
          if (!status.is_running) {
            clearInterval(interval);
            setFetchingJobs(false);
            load();
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

  // Multi-criteria filter logic
  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      // 1. Min Fit Score Filter
      if (minFit > 0 && j.fit_score !== null && j.fit_score < minFit) {
        return false;
      }

      // 2. Freshness Filter
      if (freshnessFilter !== "all" && j.posted_at) {
        const diffHrs = (Date.now() - new Date(j.posted_at).getTime()) / 3600000;
        if (freshnessFilter === "24h" && diffHrs > 24) return false;
        if (freshnessFilter === "3d" && diffHrs > 72) return false;
        if (freshnessFilter === "7d" && diffHrs > 168) return false;
      }

      // 3. Workplace / Location Filter
      if (workplaceFilter !== "all") {
        const loc = (j.location || "").toLowerCase();
        if (workplaceFilter === "remote") {
          const isRem = loc.includes("remote") || loc.includes("distributed") || loc.includes("anywhere");
          if (!isRem) return false;
        } else if (workplaceFilter === "india") {
          const isInd = loc.includes("india") || loc.includes("bengaluru") || loc.includes("bangalore") || loc.includes("hyderabad") || loc.includes("delhi") || loc.includes("pune") || loc.includes("mumbai");
          if (!isInd) return false;
        }
      }

      // 4. Live Text & Semantic Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (j.title || "").toLowerCase().includes(q);
        const companyMatch = (j.company || "").toLowerCase().includes(q);
        const locMatch = (j.location || "").toLowerCase().includes(q);
        const reasonMatch = (j.fit_reason || "").toLowerCase().includes(q);
        const descMatch = (j.description || "").toLowerCase().includes(q);
        if (!titleMatch && !companyMatch && !locMatch && !reasonMatch && !descMatch) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, minFit, freshnessFilter, workplaceFilter, searchQuery]);

  const byStatus = (status) => filtered.filter((j) => j.status === status);

  return (
    <div className="min-h-screen bg-ink text-text flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="border-b border-border/80 bg-surface/50 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-signal/30 to-cool/30 border border-signal/40 flex items-center justify-center font-mono font-bold text-sm text-signal">
              AI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-text text-base font-semibold tracking-tight">AI Job Tracker</h1>
                {profile && (
                  <span className="text-[11px] bg-ink border border-border px-2 py-0.5 rounded-full text-signal font-mono">
                    {profile.name}
                  </span>
                )}
              </div>
              <p className="text-muted text-[11px] font-mono">
                {filtered.length} of {jobs.length} jobs matching filters
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Resume Upload Button */}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="text-xs bg-surface2 hover:bg-surface border border-border hover:border-signal/50 text-text rounded-lg px-3 py-1.5 transition flex items-center gap-1.5 shadow-sm"
            >
              <span>📄</span>
              <span>Upload Resume</span>
            </button>

            {/* Manual Add Job Button */}
            <button
              onClick={() => setIsAddJobOpen(true)}
              className="text-xs bg-surface2 hover:bg-surface border border-border hover:border-signal/50 text-text rounded-lg px-3 py-1.5 transition flex items-center gap-1.5 shadow-sm"
            >
              <span>➕</span>
              <span>Add Job</span>
            </button>

            {/* On-demand Job Fetcher */}
            <button
              onClick={handleTriggerFetch}
              disabled={fetchingJobs}
              className="text-xs bg-signal hover:bg-signal/90 text-black font-semibold rounded-lg px-3.5 py-1.5 disabled:opacity-50 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className={fetchingJobs ? "animate-spin" : ""}>✨</span>
              <span>{fetchingJobs ? "Matching Jobs..." : "Fetch New Jobs"}</span>
            </button>

            <button
              onClick={load}
              className="text-xs text-muted hover:text-cool border border-border hover:border-cool/40 rounded-lg px-3 py-1.5 transition"
              title="Refresh jobs"
            >
              ↻
            </button>
          </div>
        </div>
      </nav>

      {/* Filter & Search Toolbar */}
      <div className="border-b border-border/60 bg-ink/70 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search by role, skills, company (e.g. PySpark, RAG, Stripe)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface2/90 border border-border hover:border-border/90 focus:border-cool text-text text-xs rounded-lg pl-8 pr-8 py-2 focus:outline-none placeholder:text-muted/60 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filters Group */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Freshness Toggle Pills */}
            <div className="flex items-center bg-surface2 border border-border rounded-lg p-0.5 text-xs font-medium">
              {[
                { id: "all", label: "All Time" },
                { id: "24h", label: "🔥 Last 24h" },
                { id: "3d", label: "Last 3 Days" },
                { id: "7d", label: "Last 7 Days" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setFreshnessFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-md transition text-xs ${
                    freshnessFilter === pill.id
                      ? "bg-ink text-signal border border-signal/30 shadow-xs"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Workplace / Location Pills */}
            <div className="flex items-center bg-surface2 border border-border rounded-lg p-0.5 text-xs font-medium">
              {[
                { id: "all", label: "Everywhere" },
                { id: "remote", label: "🌐 Remote Only" },
                { id: "india", label: "📍 India" },
              ].map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setWorkplaceFilter(loc.id)}
                  className={`px-2.5 py-1 rounded-md transition text-xs ${
                    workplaceFilter === loc.id
                      ? "bg-ink text-cool border border-cool/30 shadow-xs"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>

            {/* Min Fit Slider */}
            <div className="flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3 py-1">
              <span className="text-muted text-xs">Min match:</span>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={minFit}
                onChange={(e) => setMinFit(Number(e.target.value))}
                className="accent-signal h-1.5 w-16 cursor-pointer"
              />
              <span className="font-mono text-signal text-xs w-7 font-semibold">
                {minFit > 0 ? `${minFit}%` : "0%"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar jobs={jobs} />

      {/* Main Kanban Content */}
      <main className="flex-1 px-6 py-6 overflow-x-auto">
        <div className="max-w-7xl mx-auto">
          {pipelineMessage && (
            <div className="bg-panel border border-border text-cool text-xs rounded-xl px-4 py-2.5 mb-5 flex items-center justify-between font-mono animate-fade-in shadow-sm">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-signal animate-ping"></span>
                {pipelineMessage}
              </span>
              {fetchingJobs && <span className="text-muted text-[11px]">Auto-refreshing board...</span>}
            </div>
          )}

          {error && (
            <div className="text-warn bg-warn/10 border border-warn/30 text-xs rounded-xl p-3 mb-5 font-mono">
              Couldn't reach the API: {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64 text-muted text-sm font-mono">
              <span className="animate-pulse">Loading job pipeline&hellip;</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-surface/40 border border-border border-dashed rounded-2xl p-12 text-center my-8">
              <div className="text-3xl mb-2">🔍</div>
              <h3 className="text-text font-medium text-sm">No jobs match your current filters</h3>
              <p className="text-muted text-xs mt-1 max-w-sm mx-auto">
                Try lowering the match threshold, switching freshness to "All Time", or searching for broader terms.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setMinFit(0);
                  setFreshnessFilter("all");
                  setWorkplaceFilter("all");
                }}
                className="mt-4 text-xs bg-surface2 border border-border hover:border-signal text-signal px-3 py-1.5 rounded-lg transition"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-6 items-start">
              {COLUMNS.map((status) => (
                <KanbanColumn
                  key={status}
                  title={status}
                  jobs={byStatus(status)}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onDraftPitch={(job) => setSelectedPitchJob(job)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Manual Add Job Modal */}
      <AddJobModal
        isOpen={isAddJobOpen}
        onClose={() => setIsAddJobOpen(false)}
        onAdded={(newJob) => {
          setJobs((prev) => [newJob, ...prev]);
        }}
      />

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

      {/* AI Pitch & Cover Letter Generator Modal */}
      <PitchModal
        isOpen={!!selectedPitchJob}
        onClose={() => setSelectedPitchJob(null)}
        job={selectedPitchJob}
        candidateProfile={profile}
      />
    </div>
  );
}
