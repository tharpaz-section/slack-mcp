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
