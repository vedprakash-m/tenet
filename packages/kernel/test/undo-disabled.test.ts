// Preview: undo is disabled by default, so neither the preview nor the confirmation can touch the working tree.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("undo in the preview", () => {
  it("[GIT-04] refuses undo and undo-confirm without changing HEAD, index or files", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const finished = (await finishFixture(p, { h, subject: "Add greet" })).data as { endpoint?: string } | undefined;
    assert.equal(finished?.endpoint, "checked-local");
    const head = p.git("rev-parse", "HEAD"), index = readFileSync(join(p.root, ".git/index"));
    const source = readFileSync(join(p.root, "src/greet.ts"), "utf8");

    const preview = await p.call("undo", { h });
    assert.equal(preview.exit, 2);
    assert.equal(preview.reasons?.[0]?.code, "capability-missing");
    assert.equal(preview.questions?.length ?? 0, 0);
    const confirm = await p.call("decide", { h, kind: "undo-confirm", answers: { "undo-confirm": "apply" } });
    assert.notEqual(confirm.exit, 0);

    assert.equal(p.git("rev-parse", "HEAD"), head);
    assert.deepEqual(readFileSync(join(p.root, ".git/index")), index);
    assert.equal(readFileSync(join(p.root, "src/greet.ts"), "utf8"), source);
  });
});
