import { useState } from "react";
import { uploadResumeFile } from "../api";

export default function ResumeUploadModal({ isOpen, onClose, currentProfile, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const res = await uploadResumeFile(file);
      onUploadSuccess(res.profile);
      onClose();
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-canvas border border-border rounded-xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-text font-semibold text-base">Candidate Resume & Profile</h2>
            <p className="text-muted text-xs mt-0.5">Upload a PDF or TXT resume for AI job matching</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text text-sm px-2 py-1"
          >
            &times;
          </button>
        </div>

        {/* Current profile summary */}
        {currentProfile && (
          <div className="my-4 p-3 bg-panel border border-border rounded-lg text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted">Active Candidate:</span>
              <span className="text-signal font-medium">{currentProfile.name || "Abhay Raj"}</span>
            </div>
            {currentProfile.titles && (
              <div className="text-muted">
                <span className="text-text">Target Roles:</span> {currentProfile.titles.join(", ")}
              </div>
            )}
            {currentProfile.skills && (
              <div className="flex flex-wrap gap-1 mt-1">
                {currentProfile.skills.slice(0, 10).map((s, i) => (
                  <span key={i} className="bg-ink border border-border px-1.5 py-0.5 rounded text-[10px] text-cool">
                    {s}
                  </span>
                ))}
                {currentProfile.skills.length > 10 && (
                  <span className="text-[10px] text-muted self-center">+{currentProfile.skills.length - 10} more</span>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-border hover:border-signal rounded-lg p-6 text-center cursor-pointer relative">
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => setFile(e.target.files[0])}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="text-muted text-xs space-y-1 pointer-events-none">
              <p className="text-text font-medium text-sm">
                {file ? file.name : "Click or drag your Resume here"}
              </p>
              <p className="text-[11px] text-muted">Supports PDF and TXT</p>
            </div>
          </div>

          {error && <p className="text-warn text-xs font-mono">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-muted hover:text-text border border-border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploading}
              className="px-4 py-1.5 text-xs bg-signal text-black font-medium rounded hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "Analyzing with AI..." : "Parse & Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
