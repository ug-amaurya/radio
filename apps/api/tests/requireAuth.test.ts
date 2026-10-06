import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
vi.mock("../src/db/client.js", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUniqueMock(...args) } },
}));

const { requireAuth } = await import("../src/middleware/requireAuth.js");

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("requireAuth", () => {
  it("rejects when there is no session user id", async () => {
    const req = { session: {} } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects and clears the session when the user no longer exists", async () => {
    const session = { userId: "missing-user" } as Request["session"];
    const req = { session } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();
    findUniqueMock.mockResolvedValue(null);

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(session.userId).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches user and calls next on success", async () => {
    const user = { id: "user-1" };
    const req = { session: { userId: "user-1" } } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();
    findUniqueMock.mockResolvedValue(user);

    await requireAuth(req, res, next);

    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledWith();
  });

  it("forwards lookup errors to next instead of throwing", async () => {
    const user = { id: "user-1" };
    const req = { session: { userId: "user-1" } } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();
    const err = new Error("db failed");
    findUniqueMock.mockRejectedValue(err);

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
