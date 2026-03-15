import { parseArgs } from "util";
import client from "../../x/src/client";
import { askWithXSearch } from "./client";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    from: { type: "string" },
    to: { type: "string" },
    handle: { type: "string" },
    out: { type: "string", default: "tweets.json" },
  },
});

if (!values.handle) {
  console.error(
    "Usage: bun run grok/src/summarize-tweets.ts --handle <username> --from <YYYY-MM-DD> [--to <YYYY-MM-DD>] [--out <file>]"
  );
  process.exit(1);
}

const username = values.handle.replace(/^@/, "");

// Step 1: X APIでユーザーID取得
const userResponse = await client.users.getByUsername(username, {
  userFields: ["id", "name", "username"],
});
const user = userResponse.data;
if (!user) {
  console.error(`User @${username} not found.`);
  process.exit(1);
}
console.log(`Fetching tweets from @${user.username} (${user.name})...`);

// Step 2: X APIで全投稿を取得（ページネーション）
interface Tweet {
  id: string;
  text: string;
  createdAt?: string;
  publicMetrics?: Record<string, number>;
  referencedTweets?: Array<{ type: string; id: string }>;
}

const allTweets: Tweet[] = [];
let paginationToken: string | undefined;

do {
  const opts: Record<string, unknown> = {
    maxResults: 100,
    tweetFields: ["created_at", "public_metrics", "text", "referenced_tweets"],
  };
  if (values.from) opts.startTime = `${values.from}T00:00:00Z`;
  if (values.to) opts.endTime = `${values.to}T23:59:59Z`;
  if (paginationToken) opts.paginationToken = paginationToken;

  const res = await client.users.getPosts(user.id, opts as any);
  const tweets = res.data ?? [];
  allTweets.push(...(tweets as Tweet[]));

  paginationToken = (res.meta as any)?.nextToken;
  if (paginationToken) {
    console.log(`  fetched ${allTweets.length} tweets so far...`);
  }
} while (paginationToken);

console.log(`Total: ${allTweets.length} tweets fetched.\n`);

if (allTweets.length === 0) {
  console.log("No tweets found.");
  process.exit(0);
}

// Step 3: 取得した投稿をJSONファイルに保存
const tweetsOutput = allTweets.map((t) => ({
  id: t.id,
  url: `https://x.com/${username}/status/${t.id}`,
  created_at: t.createdAt,
  text: t.text,
  is_retweet: t.referencedTweets?.some((r) => r.type === "retweeted") ?? false,
  metrics: t.publicMetrics,
}));

const outPath = values.out!;
await Bun.write(outPath, JSON.stringify(tweetsOutput, null, 2));
console.log(`Raw tweets saved to: ${outPath}\n`);

// Step 4: Grokで構造化
const tweetsText = tweetsOutput
  .map(
    (t) =>
      `[${t.created_at}] ${t.is_retweet ? "(RT) " : ""}${t.text}\nURL: ${t.url}`
  )
  .join("\n\n");

const promptTemplate = await Bun.file(
  new URL("./prompt.txt", import.meta.url).pathname
).text();
const prompt = promptTemplate
  .replace("{{username}}", username)
  .replace("{{tweets}}", tweetsText);

console.log("Sending to Grok for analysis...\n");
const answer = await askWithXSearch(prompt, {
  handles: [`@${username}`],
  fromDate: values.from,
  toDate: values.to,
});

// Grokの結果をJSONファイルに保存
const resultPath = outPath.replace(/\.json$/, "-result.json");
try {
  const jsonMatch = answer.match(/```json\s*([\s\S]*?)```/) ?? answer.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : answer;
  const parsed = JSON.parse(jsonStr);
  await Bun.write(resultPath, JSON.stringify(parsed, null, 2));
} catch {
  await Bun.write(resultPath, answer);
}
console.log(`Result saved to: ${resultPath}\n`);

console.log(answer);
