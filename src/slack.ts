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
