import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlackService } from "../slack";

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

// Mock @slack/web-api
vi.mock("@slack/web-api", () => {
  return {
    WebClient: class {
      constructor() {
        return mockClient;
      }
    },
  };
});

describe("SlackService", () => {
  let service: SlackService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SlackService("xoxb-fake-token");
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
