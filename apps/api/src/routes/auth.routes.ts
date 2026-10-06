import { Router } from "express";
import { callback, guest, logout, me, socketToken } from "../controllers/auth.controller.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

authRouter.post("/callback", callback);
// Each guest session creates a DB row, so cap how fast one IP can mint them.
authRouter.post("/guest", rateLimit({ name: "guest", max: 10, windowSec: 60 * 60 }), (req, res, next) => {
  guest(req, res).catch(next);
});
authRouter.get("/me", requireAuth, me);
authRouter.get("/socket-token", requireAuth, socketToken);
authRouter.post("/logout", logout);
