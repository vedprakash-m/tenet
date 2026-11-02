export async function runJobs(jobs) {
  return Promise.all(jobs.map(async job => job()));
}
