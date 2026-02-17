import { WebClient } from "@slack/web-api";
import type { ApiResponse } from "./types";

export class SlackService {
  private client: WebClient;
  private userClient?: WebClient;

  constructor(botToken: string, userToken?: string) {
    this.client = new WebClient(botToken);
    if (userToken) {
      this.userClient = new WebClient(userToken);
    }
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
      const client = this.userClient || this.client;
      const result = await client.conversations.history({
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
    const client = this.userClient || this.client;
    try {
      const result = await client.search.messages({ query, count });
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

  async searchUsers(query: string): Promise<ApiResponse> {
    try {
      const result = await this.client.users.list({});
      const users = (result.members || []).filter((u: any) =>
        u.real_name?.toLowerCase().includes(query.toLowerCase()) ||
        u.name?.toLowerCase().includes(query.toLowerCase())
      );
      return {
        ok: true,
        users: users.map((u: any) => ({
          id: u.id,
          name: u.name,
          real_name: u.real_name,
        })),
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.data?.error || "slack_error",
        detail: err.message,
      };
    }
  }

  async openDm(userId: string): Promise<ApiResponse> {
    try {
      const result = await this.client.conversations.open({ users: userId });
      return {
        ok: true,
        channel: (result.channel as any)?.id,
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
