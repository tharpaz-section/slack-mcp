# Slack REST API Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an Express.js REST API server that wraps the Slack Web API for the Poke Interaction bot, deployed on Railway.

**Architecture:** A single Express server with three endpoints (send message, read channel history, search messages) protected by API key auth. The server uses `@slack/web-api` to talk to Slack and runs as a Docker container on Railway.

**Tech Stack:** TypeScript, Express, @slack/web-api, dotenv, vitest (testing)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Initialize package.json**

```bash
cd /Users/tomharpaz/slack-mcp-server
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install express @slack/web-api dotenv
npm install -D typescript @types/express @types/node vitest
```

**Step 3: Create tsconfig.json**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .env.example**

Create `.env.example`:
```
SLACK_BOT_TOKEN=xoxb-your-token-here
API_KEY=your-secret-api-key-here
PORT=3000
```

**Step 5: Create .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
.env
```

**Step 6: Add scripts to package.json**

Update `package.json` scripts:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "npx tsx src/index.ts",
    "test": "vitest run"
  }
}
```

**Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .env.example .gitignore
git commit -m "chore: scaffold project with dependencies and config"
```

---

### Task 2: Types

**Files:**
- Create: `src/types.ts`

**Step 1: Write the types file**

Create `src/types.ts`:
```typescript
import type { Request } from "express";

export interface SendMessageBody {
  channel: string;
  text: string;
}

export interface HistoryQuery {
  limit?: string;
  cursor?: string;
}

export interface SearchQuery {
  query: string;
  count?: string;
}

export interface ApiSuccess {
  ok: true;
  [key: string]: unknown;
}

export interface ApiError {
  ok: false;
  error: string;
  detail?: string;
}

export type ApiResponse = ApiSuccess | ApiError;

export interface HistoryParams {
  channelId: string;
}

export type SendMessageRequest = Request<{}, ApiResponse, SendMessageBody>;
export type HistoryRequest = Request<HistoryParams, ApiResponse, {}, HistoryQuery>;
export type SearchRequest = Request<{}, ApiResponse, {}, SearchQuery>;
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add request/response type definitions"
```

---

### Task 3: API Key Auth Middleware

**Files:**
- Create: `src/auth.ts`
- Create: `src/__tests__/auth.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/auth.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireApiKey } from "../auth";
import type { Request, Response, NextFunction } from "express";

function mockReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers };
}

function mockRes(): Partial<Response> & { statusCode: number; body: unknown } {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: unknown) => { res.body = data; return res; };
  return res;
}

describe("requireApiKey", () => {
  const API_KEY = "test-secret-key";
  let middleware: ReturnType<typeof requireApiKey>;

  beforeEach(() => {
    middleware = requireApiKey(API_KEY);
  });

  it("calls next() when x-api-key matches", () => {
    const req = mockReq({ "x-api-key": API_KEY });
    const res = mockRes();
    const next = vi.fn();
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 401 when x-api-key is missing", () => {
    const req = mockReq({});
    const res = mockRes();
    const next = vi.fn();
    middleware(req as Request, res as Response, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "unauthorized", detail: "Missing or invalid API key" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when x-api-key is wrong", () => {
    const req = mockReq({ "x-api-key": "wrong-key" });
    const res = mockRes();
    const next = vi.fn();
    middleware(req as Request, res as Response, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/auth.test.ts`
Expected: FAIL — `requireApiKey` not found

**Step 3: Write the implementation**

Create `src/auth.ts`:
```typescript
import type { Request, Response, NextFunction } from "express";

export function requireApiKey(apiKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const provided = req.headers["x-api-key"];
    if (provided === apiKey) {
      next();
    } else {
      res.status(401).json({
        ok: false,
        error: "unauthorized",
        detail: "Missing or invalid API key",
      });
    }
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/auth.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/auth.ts src/__tests__/auth.test.ts
git commit -m "feat: add API key auth middleware with tests"
```

---

### Task 4: Slack Client Wrapper

**Files:**
- Create: `src/slack.ts`
- Create: `src/__tests__/slack.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/slack.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlackService } from "../slack";

// Mock @slack/web-api
vi.mock("@slack/web-api", () => {
  const mockClient = {
    chat: {
      postMessage: vi.fn(),
    },
    conversations: {
      history: vi.fn(),
    },
    search: {
      messages: vi.fn(),
    },
  };
  return { WebClient: vi.fn(() => mockClient) };
});

import { WebClient } from "@slack/web-api";

describe("SlackService", () => {
  let service: SlackService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SlackService("xoxb-fake-token");
    mockClient = (WebClient as any).mock.results[0].value;
  });

  describe("sendMessage", () => {
    it("sends a message and returns ts and channel", async () => {
      mockClient.chat.postMessage.mockResolvedValue({
        ok: true,
        ts: "123.456",
        channel: "C01ABC",
      });

      const result = await service.sendMessage("C01ABC", "Hello");
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: "C01ABC",
        text: "Hello",
      });
      expect(result).toEqual({ ok: true, ts: "123.456", channel: "C01ABC" });
    });

    it("returns error when Slack API fails", async () => {
      mockClient.chat.postMessage.mockRejectedValue(
        Object.assign(new Error("channel_not_found"), {
          data: { error: "channel_not_found" },
        })
      );

      const result = await service.sendMessage("C_BAD", "Hello");
      expect(result.ok).toBe(false);
    });
  });

  describe("getChannelHistory", () => {
    it("returns messages and next_cursor", async () => {
      mockClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: [{ text: "hi", ts: "1.0" }],
        response_metadata: { next_cursor: "abc" },
      });

      const result = await service.getChannelHistory("C01ABC", 10);
      expect(mockClient.conversations.history).toHaveBeenCalledWith({
        channel: "C01ABC",
        limit: 10,
        cursor: undefined,
      });
      expect(result).toEqual({
        ok: true,
        messages: [{ text: "hi", ts: "1.0" }],
        next_cursor: "abc",
      });
    });
  });

  describe("searchMessages", () => {
    it("returns search matches", async () => {
      mockClient.search.messages.mockResolvedValue({
        ok: true,
        messages: { matches: [{ text: "poke" }], total: 1 },
      });

      const result = await service.searchMessages("poke", 20);
      expect(mockClient.search.messages).toHaveBeenCalledWith({
        query: "poke",
        count: 20,
      });
      expect(result).toEqual({
        ok: true,
        messages: { matches: [{ text: "poke" }], total: 1 },
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/slack.test.ts`
Expected: FAIL — `SlackService` not found

**Step 3: Write the implementation**

Create `src/slack.ts`:
```typescript
import { WebClient } from "@slack/web-api";
import type { ApiResponse } from "./types";

export class SlackService {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async sendMessage(channel: string, text: string): Promise<ApiResponse> {
    try {
      const result = await this.client.chat.postMessage({ channel, text });
      return { ok: true, ts: result.ts as string, channel: result.channel as string };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.data?.error || "slack_error",
        detail: err.message,
      };
    }
  }

  async getChannelHistory(
    channel: string,
    limit: number = 20,
    cursor?: string
  ): Promise<ApiResponse> {
    try {
      const result = await this.client.conversations.history({
        channel,
        limit,
        cursor,
      });
      return {
        ok: true,
        messages: result.messages || [],
        next_cursor: result.response_metadata?.next_cursor || null,
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.data?.error || "slack_error",
        detail: err.message,
      };
    }
  }

  async searchMessages(
    query: string,
    count: number = 20
  ): Promise<ApiResponse> {
    try {
      const result = await this.client.search.messages({ query, count });
      return {
        ok: true,
        messages: result.messages || { matches: [], total: 0 },
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.data?.error || "slack_error",
        detail: err.message,
      };
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/slack.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/slack.ts src/__tests__/slack.test.ts
git commit -m "feat: add Slack service wrapper with tests"
```

---

### Task 5: Express App with Routes

**Files:**
- Create: `src/index.ts`
- Create: `src/__tests__/index.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/index.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock slack service before importing app
vi.mock("../slack", () => {
  const mockService = {
    sendMessage: vi.fn(),
    getChannelHistory: vi.fn(),
    searchMessages: vi.fn(),
  };
  return { SlackService: vi.fn(() => mockService), __mockService: mockService };
});

// Set env vars before importing app
process.env.SLACK_BOT_TOKEN = "xoxb-test";
process.env.API_KEY = "test-key";

import { createApp } from "../index";
import { SlackService } from "../slack";

// Inline supertest-like helper using native fetch won't work easily,
// so we'll use the app directly with node http for testing
import http from "http";

function request(
  app: ReturnType<typeof createApp>,
  method: string,
  path: string,
  body?: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      const url = `http://localhost:${addr.port}${path}`;
      const opts: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      };
      if (body) opts.body = JSON.stringify(body);

      fetch(url, opts)
        .then(async (res) => {
          const json = await res.json();
          server.close();
          resolve({ status: res.status, body: json });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

describe("API routes", () => {
  let app: ReturnType<typeof createApp>;
  let mockService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockService = (SlackService as any).mock.results[0].value;
  });

  it("rejects requests without API key", async () => {
    const res = await request(app, "GET", "/api/search?query=test");
    expect(res.status).toBe(401);
  });

  it("POST /api/messages/send sends a message", async () => {
    mockService.sendMessage.mockResolvedValue({ ok: true, ts: "1.0", channel: "C01" });

    const res = await request(
      app,
      "POST",
      "/api/messages/send",
      { channel: "C01", text: "Hello" },
      { "x-api-key": "test-key" }
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, ts: "1.0", channel: "C01" });
  });

  it("GET /api/channels/:id/history returns messages", async () => {
    mockService.getChannelHistory.mockResolvedValue({
      ok: true,
      messages: [{ text: "hi" }],
      next_cursor: null,
    });

    const res = await request(
      app,
      "GET",
      "/api/channels/C01ABC/history?limit=10",
      undefined,
      { "x-api-key": "test-key" }
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.messages).toHaveLength(1);
  });

  it("GET /api/search returns search results", async () => {
    mockService.searchMessages.mockResolvedValue({
      ok: true,
      messages: { matches: [{ text: "poke" }], total: 1 },
    });

    const res = await request(
      app,
      "GET",
      "/api/search?query=poke",
      undefined,
      { "x-api-key": "test-key" }
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /api/messages/send returns 400 without channel", async () => {
    const res = await request(
      app,
      "POST",
      "/api/messages/send",
      { text: "Hello" },
      { "x-api-key": "test-key" }
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/search returns 400 without query", async () => {
    const res = await request(
      app,
      "GET",
      "/api/search",
      undefined,
      { "x-api-key": "test-key" }
    );
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: FAIL — `createApp` not found

**Step 3: Write the implementation**

Create `src/index.ts`:
```typescript
import express from "express";
import dotenv from "dotenv";
import { requireApiKey } from "./auth";
import { SlackService } from "./slack";
import type { SendMessageRequest, HistoryRequest, SearchRequest } from "./types";

dotenv.config();

export function createApp() {
  const app = express();
  app.use(express.json());

  const slackToken = process.env.SLACK_BOT_TOKEN;
  const apiKey = process.env.API_KEY;

  if (!slackToken || !apiKey) {
    throw new Error("SLACK_BOT_TOKEN and API_KEY environment variables are required");
  }

  const slack = new SlackService(slackToken);
  app.use("/api", requireApiKey(apiKey));

  // Health check (no auth)
  app.get("/health", (_req, res) => {
    res.json({ ok: true, status: "healthy" });
  });

  // Send a message
  app.post("/api/messages/send", async (req: SendMessageRequest, res) => {
    const { channel, text } = req.body;
    if (!channel || !text) {
      res.status(400).json({ ok: false, error: "bad_request", detail: "channel and text are required" });
      return;
    }
    const result = await slack.sendMessage(channel, text);
    res.status(result.ok ? 200 : 500).json(result);
  });

  // Read channel history
  app.get("/api/channels/:channelId/history", async (req: HistoryRequest, res) => {
    const { channelId } = req.params;
    const limit = parseInt(req.query.limit || "20", 10);
    const cursor = req.query.cursor || undefined;
    const result = await slack.getChannelHistory(channelId, limit, cursor);
    res.status(result.ok ? 200 : 500).json(result);
  });

  // Search messages
  app.get("/api/search", async (req: SearchRequest, res) => {
    const { query, count } = req.query;
    if (!query) {
      res.status(400).json({ ok: false, error: "bad_request", detail: "query parameter is required" });
      return;
    }
    const result = await slack.searchMessages(query, parseInt(count || "20", 10));
    res.status(result.ok ? 200 : 500).json(result);
  });

  return app;
}

// Start server when run directly (not imported for testing)
if (require.main === module) {
  const port = parseInt(process.env.PORT || "3000", 10);
  const app = createApp();
  app.listen(port, () => {
    console.log(`Slack API server listening on port ${port}`);
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: All tests PASS

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests across all files PASS

**Step 6: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts
git commit -m "feat: add Express app with routes and integration tests"
```

---

### Task 6: Dockerfile and Deployment Config

**Files:**
- Create: `Dockerfile`

**Step 1: Create the Dockerfile**

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Step 2: Verify Docker build works**

Run: `docker build -t slack-mcp-server .`
Expected: Image builds successfully

**Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: add Dockerfile for Railway deployment"
```

---

### Task 7: Final Verification

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Build TypeScript**

Run: `npm run build`
Expected: Compiles with no errors, `dist/` directory created

**Step 3: Verify Docker build**

Run: `docker build -t slack-mcp-server .`
Expected: Builds successfully

**Step 4: Final commit with any remaining changes**

```bash
git status
# If any changes, add and commit
```

---

### Post-Implementation: Deploy to Railway

These are manual steps for after the code is complete:

1. Create a GitHub repo and push: `git remote add origin <url> && git push -u origin main`
2. Go to [railway.app](https://railway.app), create new project from GitHub repo
3. In Railway dashboard, add environment variables:
   - `SLACK_BOT_TOKEN` = your `xoxb-...` token from [api.slack.com/apps](https://api.slack.com/apps)
   - `API_KEY` = generate a strong random key (e.g. `openssl rand -hex 32`)
4. Railway auto-deploys on push
5. Note the Railway-provided URL — that's what your Poke Interaction bot calls

### Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps), create a new app
2. Under **OAuth & Permissions**, add these bot token scopes:
   - `chat:write` — send messages
   - `channels:history` — read channel history
   - `search:read` — search messages
   - `channels:read` — list channels (needed by history)
3. Install the app to your workspace
4. Copy the **Bot User OAuth Token** (`xoxb-...`) to Railway env vars
