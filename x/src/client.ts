import { Client } from "@xdevplatform/xdk";

const bearerToken = process.env.BEARER_TOKEN;
if (!bearerToken) {
  console.error("BEARER_TOKEN is not set. Copy .env.example to .env and set your token.");
  process.exit(1);
}

const client = new Client({ bearerToken });
export default client;
