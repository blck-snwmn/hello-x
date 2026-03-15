# hello-x

A collection of CLI tools for experimenting with X-related APIs. Built with Bun workspaces.

## Setup

```sh
bun install
```

Create a `.env` file in the project root and set the required keys.

```
BEARER_TOKEN=your_bearer_token_here
GROK_API_KEY=your_grok_api_key_here
```

## Commands

### x — X API v2 client (requires `BEARER_TOKEN`)

```sh
# Fetch a user's recent tweets
bun run x/src/user-tweets.ts <username>

# Stream tweets matching a rule in real time (Ctrl+C to stop)
bun run x/src/filtered-stream.ts "<rule>"
```

### grok — Grok x_search client (requires `GROK_API_KEY`)

```sh
# Answer a question based on posts on X
bun run grok/src/ask.ts "<question>"

# Options: --from DATE, --to DATE, --handle @user
bun run grok/src/ask.ts --from 2026-01-01 --handle @user "question"
```
