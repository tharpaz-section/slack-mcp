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
