import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock slack service before importing app
const mockService = {
  sendMessage: vi.fn(),
  getChannelHistory: vi.fn(),
  searchMessages: vi.fn(),
};

vi.mock("../slack", () => {
  return {
    SlackService: vi.fn(function (this: any) {
      Object.assign(this, mockService);
    }),
  };
});

// Set env vars before importing app
process.env.SLACK_BOT_TOKEN = "xoxb-test";
process.env.API_KEY = "test-key";

import { createApp } from "../index";
import { SlackService } from "../slack";

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

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
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
