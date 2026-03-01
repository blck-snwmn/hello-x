import { askWithXSearch, type XSearchOptions } from "./client";
import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    from: { type: "string" },
    to: { type: "string" },
    handle: { type: "string", multiple: true },
  },
  allowPositionals: true,
});

const question = positionals[0];
if (!question) {
  console.error(
    "Usage: bun run grok/src/ask.ts [--from DATE] [--to DATE] [--handle @user ...] <question>",
  );
  process.exit(1);
}

const options: XSearchOptions = {};
if (values.from) options.fromDate = values.from;
if (values.to) options.toDate = values.to;
if (values.handle) options.handles = values.handle;

console.log(`Q: ${question}`);
if (Object.keys(options).length > 0) console.log(`Options: ${JSON.stringify(options)}`);
console.log();

const answer = await askWithXSearch(question, options);
console.log(`A: ${answer}`);
