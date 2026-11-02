export async function runJobs(jobs) {
  return Promise.all(jobs.map(async job => { try { return await job(); } catch { return undefined; } }));
}
