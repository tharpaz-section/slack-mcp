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
