import { useState } from "react";
import { addJob } from "../api";

const EMPTY = {
  title: "",
  company: "",
  location: "",
  url: "",
  description: "",
  salary_min: "",
  salary_max: "",
};

export default function AddJobModal({ isOpen, onClose, onAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.company.trim()) return;

    try {
      setSaving(true);
      setError(null);
      const payload = {
        ...form,
        source: "manual",
        salary_min: form.salary_min ? parseFloat(form.salary_min) : null,
        salary_max: form.salary_max ? parseFloat(form.salary_max) : null,
      };
      const created = await addJob(payload);
      onAdded(created);
      setForm(EMPTY);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add job");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setForm(EMPTY);
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-canvas border border-border rounded-xl w-full max-w-lg p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-text font-semibold text-base">Add Job Manually</h2>
            <p className="text-muted text-xs mt-0.5">Paste a job you found on LinkedIn, Naukri, or anywhere else</p>
          </div>
          <button onClick={handleClose} className="text-muted hover:text-text text-sm px-2 py-1">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {/* Title + Company — required */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted font-medium">Job Title <span className="text-warn">*</span></label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Backend Engineer"
                required
                className="bg-ink border border-border focus:border-cool rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-muted/50 focus:outline-none transition"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted font-medium">Company <span className="text-warn">*</span></label>
              <input
                name="company"
                value={form.company}
                onChange={handleChange}
                placeholder="e.g. Stripe"
                required
                className="bg-ink border border-border focus:border-cool rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-muted/50 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Location + URL */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted font-medium">Location</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g. Remote / Bengaluru"
                className="bg-ink border border-border focus:border-cool rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-muted/50 focus:outline-none transition"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted font-medium">Job URL</label>
              <input
                name="url"
                value={form.url}
                onChange={handleChange}
                placeholder="https://..."
                type="url"
                className="bg-ink border border-border focus:border-cool rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-muted/50 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Salary range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted font-medium">Salary Min</label>
              <input
                name="salary_min"
                value={form.salary_min}
                onChange={handleChange}
                placeholder="e.g. 80000"
                type="number"
                min="0"
                className="bg-ink border border-border focus:border-cool rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-muted/50 focus:outline-none transition"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted font-medium">Salary Max</label>
              <input
                name="salary_max"
                value={form.salary_max}
                onChange={handleChange}
                placeholder="e.g. 120000"
                type="number"
                min="0"
                className="bg-ink border border-border focus:border-cool rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-muted/50 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted font-medium">Job Description / Notes</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Paste the job description or key requirements..."
              rows={4}
              className="bg-ink border border-border focus:border-cool rounded-lg px-2.5 py-2 text-xs text-text placeholder:text-muted/50 resize-none focus:outline-none transition"
            />
          </div>

          {error && <p className="text-warn text-xs font-mono">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs text-muted hover:text-text border border-border rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim() || !form.company.trim()}
              className="px-4 py-1.5 text-xs bg-signal text-black font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition"
            >
              {saving ? "Adding..." : "Add to Board"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
