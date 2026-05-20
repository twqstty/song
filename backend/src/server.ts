import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";

type Role = "admin" | "user";

interface Artist {
  id: string;
  name: string;
  image?: string;
}

interface Track {
  id: string;
  title: string;
  artistId: string | null;
  answer: string;
  audioUrl: string;
}

interface Settings {
  rounds: number;
  autoPlay: boolean;
  allowSkip: boolean;
  showProgress: boolean;
}

interface Player {
  id: string;
  name: string;
  role: Role;
  registeredAt: string;
}

interface LeaderboardEntry {
  playerId?: string;
  name: string;
  role?: Role;
  score: number;
}

interface GameState {
  score: number;
}

interface AppState {
  artists: Artist[];
  tracks: Track[];
  settings: Settings;
  players: Player[];
  currentPlayer: Player | null;
  leaderboard: LeaderboardEntry[];
  game: GameState;
}

interface CatalogItem {
  id: string;
  artistName: string;
  title: string;
  answer: string;
  audioUrl: string;
  artworkUrl: string;
  source: "itunes";
  storeUrl: string;
}

interface ItunesTrack {
  trackId?: number;
  collectionId?: number;
  previewUrl?: string;
  trackName?: string;
  trackCensoredName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
}

interface ItunesSearchResponse {
  results?: ItunesTrack[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const stateFile = path.join(dataDir, "state.json");
const port = Number(process.env.PORT || 3001);

const defaultState: AppState = {
  artists: [],
  tracks: [],
  settings: {
    rounds: 5,
    autoPlay: true,
    allowSkip: true,
    showProgress: true
  },
  players: [],
  currentPlayer: null,
  leaderboard: [],
  game: {
    score: 0
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRole(role: unknown): Role {
  return role === "admin" ? "admin" : "user";
}

function normalizePlayer(player: unknown, fallbackRole: Role = "user"): Player | null {
  if (!isRecord(player) || !player.name) {
    return null;
  }

  const name = String(player.name).trim().replace(/\s+/g, " ").slice(0, 20);

  if (!name) {
    return null;
  }

  return {
    id: String(player.id || randomUUID()),
    name,
    role: normalizeRole(player.role || fallbackRole),
    registeredAt: String(player.registeredAt || new Date().toISOString())
  };
}

function normalizePlayerState(state: Record<string, unknown>) {
  const storedPlayers = Array.isArray(state.players)
    ? state.players.map((player) => normalizePlayer(player)).filter((player): player is Player => Boolean(player))
    : [];
  const currentPlayer = normalizePlayer(
    state.currentPlayer,
    storedPlayers.length ? "user" : "admin"
  );
  const players = [...storedPlayers];

  if (currentPlayer) {
    const currentPlayerIndex = players.findIndex((player) => player.id === currentPlayer.id);

    if (currentPlayerIndex >= 0) {
      players[currentPlayerIndex] = currentPlayer;
    } else {
      players.push(currentPlayer);
    }
  }

  return {
    players,
    currentPlayer
  };
}

function normalizeSettings(settings: unknown): Settings {
  const source = isRecord(settings) ? settings : {};

  return {
    ...defaultState.settings,
    rounds: Number(source.rounds || defaultState.settings.rounds),
    autoPlay: typeof source.autoPlay === "boolean" ? source.autoPlay : defaultState.settings.autoPlay,
    allowSkip: typeof source.allowSkip === "boolean" ? source.allowSkip : defaultState.settings.allowSkip,
    showProgress: typeof source.showProgress === "boolean" ? source.showProgress : defaultState.settings.showProgress
  };
}

function normalizeState(nextState: unknown): AppState {
  const source = isRecord(nextState) ? nextState : {};
  const playerState = normalizePlayerState(source);

  return {
    ...defaultState,
    ...source,
    artists: Array.isArray(source.artists) ? source.artists as Artist[] : defaultState.artists,
    tracks: Array.isArray(source.tracks) ? source.tracks as Track[] : defaultState.tracks,
    leaderboard: Array.isArray(source.leaderboard)
      ? source.leaderboard as LeaderboardEntry[]
      : defaultState.leaderboard,
    players: playerState.players,
    currentPlayer: playerState.currentPlayer,
    settings: normalizeSettings(source.settings),
    game: {
      ...defaultState.game,
      ...(isRecord(source.game) ? source.game : {})
    }
  };
}

async function ensureStorage() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(stateFile, "utf8");
  } catch {
    await writeFile(stateFile, JSON.stringify(defaultState, null, 2));
  }
}

async function readState() {
  try {
    const raw = await readFile(stateFile, "utf8");
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState;
  }
}

async function writeState(nextState: AppState) {
  await writeFile(stateFile, JSON.stringify(nextState, null, 2));
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function buildSearchTerm(query: string, artistFilter: string) {
  return [artistFilter, query].filter(Boolean).join(" ").trim();
}

function toCatalogItem(item: CatalogItem): CatalogItem {
  return {
    id: String(item.id),
    artistName: item.artistName,
    title: item.title,
    answer: item.answer,
    audioUrl: item.audioUrl,
    artworkUrl: item.artworkUrl,
    source: item.source,
    storeUrl: item.storeUrl
  };
}

async function searchItunesCatalog(query: string, artistFilter: string) {
  const searchTerm = buildSearchTerm(query, artistFilter);

  if (!searchTerm) {
    return [];
  }

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", searchTerm);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "30");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`iTunes search failed with status ${response.status}`);
  }

  const payload = await response.json() as ItunesSearchResponse;
  const results = Array.isArray(payload.results) ? payload.results : [];

  return results
    .filter((item) => item.previewUrl && item.trackName && item.artistName)
    .map((item) =>
      toCatalogItem({
        id: String(item.trackId || item.collectionId || item.previewUrl),
        artistName: String(item.artistName),
        title: String(item.trackName),
        answer: String(item.trackCensoredName || item.trackName),
        audioUrl: String(item.previewUrl),
        artworkUrl: item.artworkUrl100 || item.artworkUrl60 || "",
        source: "itunes",
        storeUrl: item.trackViewUrl || item.collectionViewUrl || ""
      })
    );
}

function sendError(res: Response, statusCode: number, message: string) {
  res.status(statusCode).json({ error: message });
}

await ensureStorage();

const app = express();

app.use((_, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.options(/.*/, (_, res) => {
  res.sendStatus(204);
});
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.get("/api/state", async (_, res) => {
  const state = await readState();
  res.json(state);
});

app.put("/api/state", async (req: Request<unknown, unknown, unknown>, res) => {
  const normalizedState = normalizeState(req.body);

  await writeState(normalizedState);
  res.json({ ok: true });
});

app.get("/api/catalog/search", async (req, res) => {
  const query = normalizeText(req.query.q);
  const artistFilter = normalizeText(req.query.artist);

  try {
    const results = await searchItunesCatalog(query, artistFilter);
    res.json({ items: results });
  } catch (error) {
    console.error("Catalog search error:", error);
    sendError(res, 502, "Failed to fetch external catalog");
  }
});

app.use((_, res) => {
  sendError(res, 404, "Not found");
});

const jsonErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof SyntaxError) {
    sendError(res, 400, "Invalid JSON payload");
    return;
  }

  next(error);
};

app.use(jsonErrorHandler);

app.listen(port, () => {
  console.log(`SoundQuiz backend listening on http://localhost:${port}`);
});
