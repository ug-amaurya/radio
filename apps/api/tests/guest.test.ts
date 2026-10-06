import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
vi.mock("../src/db/client.js", () => ({
  prisma: { user: { create: (...args: unknown[]) => createMock(...args) } },
}));
const incrMock = vi.fn();
const expireMock = vi.fn();
vi.mock("../src/lib/redis.js", () => ({
  redis: { incr: (...a: unknown[]) => incrMock(...a), expire: (...a: unknown[]) => expireMock(...a) },
}));

const { guest } = await import("../src/controllers/auth.controller.js");
const { requireAudiusAccount } = await import("../src/middleware/requireAudiusAccount.js");
const { rateLimit } = await import("../src/middleware/rateLimit.js");
const { createGuestIdentity, isGuestUser } = await import("../src/lib/guest.js");

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  createMock.mockReset();
  incrMock.mockReset();
  expireMock.mockReset();
});

describe("guest identity", () => {
  it("creates unique guest- prefixed identities that are detected as guests", () => {
    const a = createGuestIdentity();
    const b = createGuestIdentity();
    expect(a.audiusUserId).not.toBe(b.audiusUserId);
    expect(isGuestUser(a)).toBe(true);
    expect(isGuestUser({ audiusUserId: "12345" })).toBe(false);
  });
});

describe("POST /auth/guest handler", () => {
  it("creates a guest user, regenerates the session and returns isGuest", async () => {
    createMock.mockImplementation(async ({ data }) => ({ id: "u1", createdAt: new Date(0), ...data }));
    const session = {
      regenerate: vi.fn((cb: (err?: Error) => void) => cb()),
    } as unknown as Request["session"];
    const req = { session } as unknown as Request;
    const res = makeRes();

    await guest(req, res);

    expect(session.regenerate).toHaveBeenCalled();
    expect(session.userId).toBe("u1");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ id: "u1", isGuest: true, displayName: "Guest" }) }),
    );
  });
});

describe("requireAudiusAccount", () => {
  it("rejects guests with 403", () => {
    const req = { user: { audiusUserId: "guest:abc" } } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();
    requireAudiusAccount(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("lets real Audius users through", () => {
    const req = { user: { audiusUserId: "12345" } } as unknown as Request;
    const next = vi.fn();
    requireAudiusAccount(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("rateLimit", () => {
  const limiter = rateLimit({ name: "t", max: 2, windowSec: 60 });
  const req = { ip: "1.2.3.4" } as Request;

  it("sets the expiry on the first hit and allows requests under the cap", async () => {
    incrMock.mockResolvedValue(1);
    const next = vi.fn();
    await limiter(req, makeRes(), next);
    expect(expireMock).toHaveBeenCalledWith("rl:t:1.2.3.4", 60);
    expect(next).toHaveBeenCalledWith();
  });

  it("returns 429 once the cap is exceeded", async () => {
    incrMock.mockResolvedValue(3);
    const res = makeRes();
    const next = vi.fn();
    await limiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });
});
