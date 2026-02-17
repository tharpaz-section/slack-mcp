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
