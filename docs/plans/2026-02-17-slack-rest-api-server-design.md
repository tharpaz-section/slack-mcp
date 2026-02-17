# Slack REST API Server for Poke Interaction Bot

## Overview

An Express.js REST API server that wraps the Slack Web API, deployed on Railway. The Poke Interaction bot calls this server over HTTP to send messages, read channel history, and search messages in the Slack workspace.

## Architecture

```
[Poke Interaction Bot]
        |
        | HTTP + x-api-key header
        v
[Express Server on Railway]
        |
        | @slack/web-api (bot token)
        v
[Slack Workspace]
```

**Dependencies:**
- `express` — HTTP server
- `@slack/web-api` — official Slack SDK
- `dotenv` — environment variable loading

## API Endpoints

All endpoints require an `x-api-key` header matching the configured API key.

### 1. Send a message

```
POST /api/messages/send
Body: { "channel": "#general", "text": "Hello!" }
Response: { "ok": true, "ts": "1234567890.123456", "channel": "C01ABC..." }
```

### 2. Read channel history

```
GET /api/channels/:channelId/history?limit=20&cursor=...
Response: { "ok": true, "messages": [...], "next_cursor": "..." }
```

### 3. Search messages

```
GET /api/search?query=poke+interaction&count=20
Response: { "ok": true, "messages": { "matches": [...], "total": 42 } }
```

### Error responses

```json
{ "ok": false, "error": "channel_not_found", "detail": "..." }
```

## Configuration

Environment variables (set in Railway dashboard):
- `SLACK_BOT_TOKEN` — Slack bot `xoxb-...` token
- `API_KEY` — secret key the bot sends in requests
- `PORT` — set automatically by Railway

## Project Structure

```
slack-mcp-server/
├── src/
│   ├── index.ts          # Express app setup, middleware, routes
│   ├── slack.ts          # Slack client wrapper
│   ├── auth.ts           # API key middleware
│   └── types.ts          # Request/response types
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env.example
```

## Deployment

1. Push to GitHub
2. Connect repo to Railway
3. Set env vars in Railway dashboard
4. Railway auto-builds from Dockerfile and deploys

## Security

- API key authentication on all endpoints
- Slack bot token stored as environment variable, never in code
- No sensitive values committed to git
