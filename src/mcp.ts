import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { SlackService } from "./slack";

const transports = new Map<string, StreamableHTTPServerTransport>();

function createMcpServer(slack: SlackService): McpServer {
  const server = new McpServer({
    name: "slack-mcp-server",
    version: "1.0.0",
  });

  server.tool(
    "send_message",
    "Send a Slack message to a user or channel",
    { channel: z.string().describe("User ID or channel ID"), text: z.string().describe("Message text") },
    async ({ channel, text }) => {
      const result = await slack.sendMessage(channel, text);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "read_dm_history",
    "Read DM or channel message history",
    {
      channel_id: z.string().describe("DM or channel ID"),
      limit: z.number().optional().default(20).describe("Number of messages to fetch"),
    },
    async ({ channel_id, limit }) => {
      const result = await slack.getChannelHistory(channel_id, limit);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "search_messages",
    "Search Slack messages",
    {
      query: z.string().describe("Search query"),
      count: z.number().optional().default(20).describe("Number of results"),
    },
    async ({ query, count }) => {
      const result = await slack.searchMessages(query, count);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "find_user",
    "Find a Slack user by name",
    { query: z.string().describe("Name to search for") },
    async ({ query }) => {
      const result = await slack.searchUsers(query);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "open_dm",
    "Open or find a DM channel with a user",
    { user_id: z.string().describe("Slack user ID") },
    async ({ user_id }) => {
      const result = await slack.openDm(user_id);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  return server;
}

export function mountMcp(app: Express, slack: SlackService, apiKey: string): void {
  const checkAuth = (req: Request, res: Response): boolean => {
    const provided = req.headers["x-api-key"];
    if (provided !== apiKey) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Unauthorized: invalid or missing API key" },
        id: null,
      });
      return false;
    }
    return true;
  };

  app.post("/mcp", async (req: Request, res: Response) => {
    if (!checkAuth(req, res)) return;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId)!;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        const newSessionId = randomUUID();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        });

        transports.set(newSessionId, transport);
        transport.onclose = () => transports.delete(newSessionId);

        const server = createMcpServer(slack);
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad request: missing session ID or not an init request" },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", async (req: Request, res: Response) => {
    if (!checkAuth(req, res)) return;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports.get(sessionId)!.handleRequest(req, res);
  });

  app.delete("/mcp", async (req: Request, res: Response) => {
    if (!checkAuth(req, res)) return;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports.get(sessionId)!.handleRequest(req, res);
  });
}
