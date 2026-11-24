const fs = require("node:fs");
const path = require("node:path");

const clone = "Q:\\Ved\\Pers\\backtest-clones\\smoke\\adr-profile";
const profileDir = path.join(clone, ".prof");
const profileFile = fs.readdirSync(profileDir).find((name) => name.endsWith(".cpuprofile"));
if (!profileFile) throw new Error("No cpuprofile found");
const profile = JSON.parse(fs.readFileSync(path.join(profileDir, profileFile), "utf8"));
const interval = profile.timeDeltas ? 1000 : 1000;
const nodes = profile.nodes || [];

const hot = nodes.map((node) => {
  const frame = node.callFrame || {};
  const url = frame.url || "";
  return {
    name: frame.functionName || "(anonymous)",
    url,
    line: (frame.lineNumber ?? 0) + 1,
    selfUs: (node.hitCount || 0) * interval,
  };
}).sort((a, b) => b.selfUs - a.selfUs).slice(0, 15);

const totalUs = nodes.reduce((sum, node) => sum + (node.hitCount || 0) * interval, 0);
const phases = { discovery: 0, parsing: 0, citations: 0, git: 0, other: 0 };
for (const node of nodes) {
  const frame = node.callFrame || {};
  const text = `${frame.functionName || ""} ${frame.url || ""}`.toLowerCase();
  const selfUs = (node.hitCount || 0) * interval;
  if (/git|spawn|execfile|child_process/.test(text)) phases.git += selfUs;
  else if (/cit(e|ation)|reference|markdownlink|link/.test(text)) phases.citations += selfUs;
  else if (/parse|yaml|markdown|spec|frontmatter|json/.test(text)) phases.parsing += selfUs;
  else if (/discover|inventory|readdir|glob|walk|readfile|stat/.test(text)) phases.discovery += selfUs;
  else phases.other += selfUs;
}

function phaseShare(value) {
  return totalUs ? value / totalUs : 0;
}

const markdown = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".prof") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.md$/i.test(entry.name)) {
      markdown.push({ path: path.relative(clone, full).replace(/\\/g, "/"), size: fs.statSync(full).size });
    }
  }
}
walk(clone);
markdown.sort((a, b) => b.size - a.size);
const markdownCount = markdown.length;
const markdownBytes = markdown.reduce((sum, item) => sum + item.size, 0);

console.log(JSON.stringify({
  profileFile,
  totalUs,
  hot,
  phases,
  phaseShares: Object.fromEntries(Object.entries(phases).map(([name, value]) => [name, phaseShare(value)])),
  markdownCount,
  markdownBytes,
  largest: markdown.slice(0, 10),
}, null, 2));
