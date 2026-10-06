import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("../src/lib/redis.js", () => ({ redis: {} }));

const { HttpError, toErrorResponse } = await import("../src/middleware/errorHandler.js");
const { usageKey, usageLevel } = await import("../src/services/audiusUsage.js");
const { createSocketToken, verifySocketToken } = await import("../src/services/socketToken.js");

const upstream = (status: number) => new AxiosError("boom", "ERR", undefined, undefined, { status } as never);

describe("toErrorResponse", () => {
  it("passes HttpError messages through", () => {
    expect(toErrorResponse(new HttpError(403, "Nope"))).toEqual({ status: 403, message: "Nope", report: false });
  });

  it("maps validation errors to 400 without reporting", () => {
    const err = new ZodError([{ code: "custom", message: "name is required", path: ["name"] }]);
    expect(toErrorResponse(err)).toMatchObject({ status: 400, message: "name is required", report: false });
  });

  it("maps Audius failures to friendly 5xx messages", () => {
    expect(toErrorResponse(upstream(429))).toMatchObject({ status: 503, report: true });
    expect(toErrorResponse(upstream(500))).toMatchObject({ status: 502, report: true });
    expect(toErrorResponse(upstream(404))).toMatchObject({ status: 404, report: false });
  });

  it("never leaks internal error text", () => {
    const r = toErrorResponse(new Error("password=hunter2 at /srv/app/db.ts"));
    expect(r.status).toBe(500);
    expect(r.message).not.toContain("hunter2");
  });
});

describe("usageLevel", () => {
  it("escalates at 80%, 95% and over the limit of 500,000", () => {
    expect(usageLevel(399_999)).toBe("ok");
    expect(usageLevel(400_000)).toBe("warn");
    expect(usageLevel(475_000)).toBe("critical");
    expect(usageLevel(500_000)).toBe("critical");
    expect(usageLevel(500_001)).toBe("over");
  });

  it("keys counters by calendar month", () => {
    expect(usageKey(new Date("2026-10-31T23:59:59Z"))).toBe("audius:usage:2026-10");
    expect(usageKey(new Date("2026-11-01T00:00:00Z"))).toBe("audius:usage:2026-11");
  });
});

describe("socket tokens", () => {
  it("round-trips a user id", () => {
    expect(verifySocketToken(createSocketToken("user-1"))).toBe("user-1");
  });

  it("rejects expired, tampered and malformed tokens", () => {
    const token = createSocketToken("user-1", 1_000);
    expect(verifySocketToken(token, 1_000 + 61_000)).toBeNull();
    const [payload, sig] = createSocketToken("user-1").split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "admin", exp: Date.now() + 60_000 })).toString("base64url");
    expect(verifySocketToken(`${forged}.${sig}`)).toBeNull();
    expect(verifySocketToken(`${payload}.bad`)).toBeNull();
    expect(verifySocketToken("garbage")).toBeNull();
    expect(verifySocketToken(undefined)).toBeNull();
  });
});
