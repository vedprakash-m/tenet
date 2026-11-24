import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , drafts] = process.argv;
let input = "";
for await (const chunk of process.stdin.setEncoding("utf8")) input += chunk;
const { assignment, answers } = JSON.parse(input);
const inventory = JSON.parse(await readFile(assignment.inventory, "utf8"));
const answered_at = new Date().toISOString();
const questions = answers.map(({ id, question, answer }) => ({ id, text: question, answer, answered_at }));
const purpose = questions.find(({ id }) => id === "Q-1")?.answer;
if (!purpose) throw new Error("Replay needs the scripted purpose answer");
for (const file of assignment.output.paths) {
  const source = await readFile(path.join(drafts, file), "utf8");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, source.replaceAll("{{revision}}", () => inventory.revision).replaceAll("{{purpose}}", () => purpose), { flag: "wx" });
}
await writeFile(".tenet/onboard/interview.json", `${JSON.stringify({ questions }, null, 2)}\n`, { flag: "wx" });
