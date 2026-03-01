import client from "./client.ts";

const username = process.argv[2];
if (!username) {
  console.error("Usage: bun run x/src/user-tweets.ts <username>");
  process.exit(1);
}

// ユーザー名からユーザーIDを取得
const userResponse = await client.users.getByUsername(username, {
  userFields: ["id", "name", "username", "public_metrics"],
});

const user = userResponse.data;
if (!user) {
  console.error(`User @${username} not found.`);
  process.exit(1);
}

console.log(`\n@${user.username} (${user.name})`);
if (user.publicMetrics) {
  console.log(`  Metrics: ${JSON.stringify(user.publicMetrics)}`);
}

// ユーザーIDからポスト一覧を取得
const tweetsResponse = await client.users.getPosts(user.id, {
  maxResults: 10,
  exclude: ["retweets", "replies"],
  tweetFields: ["created_at", "public_metrics", "text"],
});

const tweets = tweetsResponse.data;
if (!tweets || tweets.length === 0) {
  console.log("\nNo tweets found.");
  process.exit(0);
}

console.log(`\n--- Recent ${tweets.length} tweets ---\n`);
for (const tweet of tweets) {
  console.log(`[${tweet.createdAt ?? "unknown date"}]`);
  console.log(tweet.text);
  if (tweet.publicMetrics) {
    console.log(`  Metrics: ${JSON.stringify(tweet.publicMetrics)}`);
  }
  console.log("---");
}
