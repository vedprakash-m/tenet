import { Readable } from "node:stream";

export type FakeOutput = {
  isTTY: boolean;
  text: string;
  write(value: string | Uint8Array): true;
};

export function fakeTty(input = ""): {
  stdin: NodeJS.ReadableStream;
  stdout: FakeOutput;
  stderr: FakeOutput;
} {
  const stdin = Readable.from([input]);
  Object.defineProperty(stdin, "isTTY", { value: true });
  const output = (): FakeOutput => ({
    isTTY: true,
    text: "",
    write(value) {
      this.text += typeof value === "string" ? value : Buffer.from(value).toString("utf8");
      return true;
    },
  });
  return { stdin, stdout: output(), stderr: output() };
}
