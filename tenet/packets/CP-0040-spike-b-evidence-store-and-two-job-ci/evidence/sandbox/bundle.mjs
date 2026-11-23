// Spike B prototype of `tenet verify --bundle`: writes bundle.json beside the reports.
import fs from 'node:fs';
fs.mkdirSync('tenet-bundle', { recursive: true });
fs.writeFileSync('tenet-bundle/bundle.json', JSON.stringify({
  run: { id: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, job: process.env.GITHUB_JOB, index: process.env.TENET_JOB_INDEX },
  outcome: process.env.TENET_TEST_OUTCOME, head: process.env.GITHUB_SHA,
}, null, 2));
