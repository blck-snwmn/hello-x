// TODO: Grok API クライアントを実装する
// 素の fetch で Grok API を呼び出す想定

const apiKey = process.env.GROK_API_KEY;
if (!apiKey) {
  console.error("GROK_API_KEY is not set. Copy .env.example to .env and set your key.");
  process.exit(1);
}

console.log("Grok client is not yet implemented.");
