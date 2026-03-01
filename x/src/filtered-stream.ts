import client from "./client.ts";

const ruleValue = process.argv[2];
if (!ruleValue) {
  console.error('Usage: bun run x/src/filtered-stream.ts "<rule>"');
  console.error('Examples:');
  console.error('  bun run x/src/filtered-stream.ts "from:username"');
  console.error('  bun run x/src/filtered-stream.ts "#hashtag"');
  console.error('  bun run x/src/filtered-stream.ts "keyword has:images"');
  process.exit(1);
}

// NOTE: Filtered Stream は1プロジェクトにつき同時接続1本のみ。
// 2本目を接続すると 429 エラーになる。

// 既存ルールを取得して表示
console.log("Fetching existing rules...");
const existingRules = await client.stream.getRules();
if (existingRules.data && existingRules.data.length > 0) {
  console.log(`Found ${existingRules.data.length} existing rule(s):`);
  for (const rule of existingRules.data) {
    console.log(`  [${rule.id}] ${rule.value} (tag: ${rule.tag ?? "none"})`);
  }
} else {
  console.log("No existing rules.");
}

// 既存ルールに同じものがあれば再利用、なければ追加
let ruleId: string | undefined;
const existingRule = existingRules.data?.find((r) => r.value === ruleValue);
if (existingRule) {
  ruleId = existingRule.id;
  console.log(`\nReusing existing rule: [${ruleId}] ${existingRule.value}`);
} else {
  console.log(`\nAdding rule: "${ruleValue}"`);
  const addResult = await client.stream.updateRules({
    add: [{ value: ruleValue, tag: "cli-rule" }],
  });

  const addedRule = addResult.data?.[0];
  if (!addedRule) {
    console.error("Failed to add rule.");
    if (addResult.errors) {
      for (const err of addResult.errors) {
        console.error(`  Error: ${JSON.stringify(err)}`);
      }
    }
    process.exit(1);
  }
  ruleId = addedRule.id;
  console.log(`Rule added: [${ruleId}] ${addedRule.value}`);
}

// ストリームに接続
// NOTE: Filtered Stream は接続中のリアルタイム投稿のみ受信する。
// 接続が切れている間の投稿は失われるため、再接続時に欠損を補完するには
// Recent Search API (GET /2/tweets/search/recent) を start_time / end_time 指定で
// 呼び出し、切断期間中の投稿を取得する必要がある。
// 課金は API コール数ではなく取得ポスト数（デイリーデデュプリケーション適用）。
console.log("\nConnecting to filtered stream... (Ctrl+C to stop)\n");
const stream = await client.stream.posts({
  tweetFields: ["created_at", "author_id", "text"],
  expansions: ["author_id"],
  userFields: ["username", "name"],
});

// NOTE: ストリームのイベントデータはSDKが正規化せず JSON.parse そのままのため、
// X API のレスポンス形式（snake_case）でアクセスする。
stream.on("data", (event: { data?: any; includes?: any; matching_rules?: any[] }) => {
  const tweet = event.data;
  if (!tweet) return;

  const users = event.includes?.users;
  const author = users?.find((u: any) => u.id === tweet.author_id);
  const displayName = author ? `@${author.username} (${author.name})` : tweet.author_id;

  const receivedAt = new Date().toISOString();
  console.log(`[posted: ${tweet.created_at ?? "unknown"} | received: ${receivedAt}] ${displayName}`);
  console.log(tweet.text);
  if (tweet.public_metrics) {
    console.log(`  Metrics: ${JSON.stringify(tweet.public_metrics)}`);
  }
  if (event.matching_rules) {
    const ruleNames = event.matching_rules.map((r: any) => r.tag ?? r.id).join(", ");
    console.log(`  Matched: ${ruleNames}`);
  }
  console.log("---");
});

stream.on("error", (error: any) => {
  console.error("Stream error:", error);
});

// グレースフルシャットダウン
async function cleanup() {
  console.log("\nDisconnecting stream...");
  stream.close();

  // ルールを削除
  if (ruleId) {
    console.log(`Removing rule [${ruleId}]...`);
    await client.stream.updateRules({
      delete: { ids: [ruleId] },
    });
    console.log("Rule removed.");
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
