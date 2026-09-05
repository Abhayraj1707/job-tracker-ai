import JobCard from "./JobCard";

export default function KanbanColumn({ title, jobs, onStatusChange, onDelete }) {
  return (
    <div className="flex flex-col min-w-[280px] w-[280px] shrink-0">
      <div className="flex items-baseline justify-between px-1 pb-2">
        <h2 className="text-text text-sm font-semibold">{title}</h2>
        <span className="text-muted text-xs font-mono">{jobs.length}</span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 160px)" }}>
        {jobs.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-4 text-muted text-xs">
            Nothing here yet.
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard key={job.id} job={job} onStatusChange={onStatusChange} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}
