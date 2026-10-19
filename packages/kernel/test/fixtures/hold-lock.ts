// Child process: takes the transaction lock, announces it, and holds it until killed.
import { newStore } from "../helpers.ts";
const store = newStore(process.argv[2]!);
await store.transaction("hold", async () => {
  console.log("held");
  await new Promise((r) => setTimeout(r, 60000));
});
