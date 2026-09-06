const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function fetchJobs() {
  const res = await fetch(`${BASE_URL}/jobs/`);
  if (!res.ok) throw new Error("Failed to fetch jobs");
  return res.json();
}

export async function updateJobStatus(jobId, status) {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update status");
  return res.json();
}

export async function deleteJob(jobId) {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete job");
  return res.json();
}

export async function getProfile() {
  const res = await fetch(`${BASE_URL}/resume/profile`);
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function uploadResumeFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/resume/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload and parse resume");
  return res.json();
}

export async function triggerJobFetch() {
  const res = await fetch(`${BASE_URL}/resume/fetch-and-match`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to start job matching");
  return res.json();
}

export async function getPipelineStatus() {
  const res = await fetch(`${BASE_URL}/resume/pipeline-status`);
  if (!res.ok) throw new Error("Failed to get pipeline status");
  return res.json();
}
