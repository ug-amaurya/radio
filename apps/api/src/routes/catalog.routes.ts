import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { getProvider } from "../providers/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAudiusAccount } from "../middleware/requireAudiusAccount.js";

// Express 4 doesn't catch rejected promises from async handlers.
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const TIMES = ["week", "month", "allTime"] as const;
type Time = (typeof TIMES)[number];

export const catalogRouter = Router();
export const libraryRouter = Router();

catalogRouter.get(
  "/trending",
  wrap(async (req, res) => {
    const genre = typeof req.query.genre === "string" ? req.query.genre : undefined;
    const time = TIMES.find((t) => t === req.query.time) as Time | undefined;
    res.json({ tracks: await getProvider().getTrending({ genre, time }) });
  }),
);

catalogRouter.get(
  "/search",
  wrap(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.status(400).json({ error: "q query param is required" });
      return;
    }
    res.json({ tracks: await getProvider().search(q) });
  }),
);

catalogRouter.get(
  "/tracks/:id/related",
  wrap(async (req, res) => {
    res.json({ tracks: await getProvider().getRelated(req.params.id!) });
  }),
);

catalogRouter.get(
  "/tracks/:id/stream",
  wrap(async (req, res) => {
    res.json({ url: await getProvider().getStreamUrl(req.params.id!) });
  }),
);

libraryRouter.use(requireAuth);

libraryRouter.get(
  "/favorites",
  requireAudiusAccount,
  wrap(async (req, res) => {
    res.json({ tracks: await getProvider().getUserFavorites(req.user!.audiusUserId) });
  }),
);

libraryRouter.get(
  "/playlists",
  requireAudiusAccount,
  wrap(async (req, res) => {
    res.json({ playlists: await getProvider().getUserPlaylists(req.user!.audiusUserId) });
  }),
);

libraryRouter.get(
  "/playlists/:id/tracks",
  wrap(async (req, res) => {
    res.json({ tracks: await getProvider().getPlaylistTracks(req.params.id!) });
  }),
);
