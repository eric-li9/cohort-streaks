import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
  INTERESTS,
  REWARD_WEEKS,
  progressFor,
  weekOf,
  type Grant,
  type Meetup,
  type Memory,
  type Person,
  type Profile,
  type Snapshot,
} from "./pilot";

const SESSION = "unistreak_session";
const SESSION_AGE = 30 * 24 * 60 * 60;
const invite = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,50}$/),
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(80),
  group: z.string().trim().min(1).max(80),
  admin: z.boolean().default(false),
  code: z.string().min(24).max(200),
});
const rosterSchema = z
  .array(invite)
  .refine(
    (rows) =>
      new Set(rows.map((r) => r.id)).size === rows.length &&
      new Set(rows.map((r) => r.code)).size === rows.length,
  );
const actionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("profile"),
    profile: z.object({
      interests: z
        .array(z.string().refine((v) => Object.hasOwn(INTERESTS, v)))
        .min(1)
        .max(5),
      major: z.string().trim().max(80),
      hometown: z.string().trim().max(80),
    }),
  }),
  z.object({ kind: z.literal("log"), title: z.string().trim().min(1).max(100) }),
  z.object({ kind: z.literal("confirm"), id: z.string().uuid() }),
  z.object({ kind: z.literal("cancel"), id: z.string().uuid() }),
  z.object({ kind: z.literal("like"), id: z.string().uuid(), liked: z.boolean() }),
  z.object({
    kind: z.literal("comment"),
    id: z.string().uuid(),
    text: z.string().trim().min(1).max(250),
  }),
  z.object({
    kind: z.literal("memory"),
    id: z.string().uuid(),
    caption: z.string().trim().max(400),
    photo: z
      .string()
      .max(1_400_000)
      .regex(/^(?:data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2})?$/),
  }),
  z.object({ kind: z.literal("freeze"), group: z.string() }),
  z.object({ kind: z.literal("reward"), group: z.string() }),
]);

type State = {
  sessions: Record<string, { member: string; expires: number }>;
  profiles: Record<string, Profile>;
  meetups: Meetup[];
  grants: Grant[];
  rewarded: string[];
  memories: (Memory & { photo: string })[];
};

class RequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const hash = (value: string) => createHash("sha256").update(value).digest();
const json = (value: unknown, status = 200, headers?: Record<string, string>) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });

function read(path: string): State {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as State;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { sessions: {}, profiles: {}, meetups: [], grants: [], rewarded: [], memories: [] };
  }
}

function save(path: string, state: State) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = path + ".tmp";
  writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
  renameSync(temporary, path);
}

function sessionCookie(request: Request, value: string, age: number) {
  const https = new URL(process.env["UNISTREAK_ORIGIN"] ?? request.url).protocol === "https:";
  return `${SESSION}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${https ? "; Secure" : ""}`;
}

async function body(request: Request, max: number) {
  if (!request.headers.get("content-type")?.startsWith("application/json") || !request.body) {
    throw new RequestError("Expected JSON.");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new RequestError("This upload is too large.", 413);
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export async function handlePilot(request: Request) {
  const { pathname, origin } = new URL(request.url);
  const endpoint = pathname.slice("/api/pilot/".length);
  try {
    const isWrite = request.method === "POST";
    if (!isWrite && request.method !== "GET") throw new RequestError("Method not allowed.", 405);
    if (isWrite && request.headers.get("origin") !== (process.env["UNISTREAK_ORIGIN"] ?? origin)) {
      throw new RequestError("Request origin could not be verified.", 403);
    }
    const input = isWrite ? await body(request, endpoint === "action" ? 1_410_000 : 4096) : null;
    const roster = rosterSchema.parse(JSON.parse(process.env["UNISTREAK_ROSTER"] ?? "[]"));
    const amount = Number(process.env["UNISTREAK_REWARD"] ?? "25");
    if (!Number.isInteger(amount) || amount < 0 || amount > 1000)
      throw new Error("Invalid reward amount");

    const path = resolve(process.env["UNISTREAK_DATA"] ?? ".unistreak/state.json");
    // All reads and writes after body parsing run synchronously in one Node process.
    const state = read(path);
    const now = Date.now();
    const week = weekOf(now);
    const token = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)unistreak_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    const sessionKey = token ? hash(token).toString("hex") : "";
    const session = state.sessions[sessionKey];
    const account =
      session && session.expires > now
        ? roster.find((member) => member.id === session.member)
        : undefined;

    if (isWrite && endpoint === "join") {
      const { code } = z.object({ code: z.string().trim().min(1).max(200) }).parse(input);
      const codeHash = hash(code);
      const member = roster.find((row) => timingSafeEqual(hash(row.code), codeHash));
      if (!member) throw new RequestError("That invite code wasn’t recognized.", 401);
      const newToken = randomBytes(32).toString("hex");
      for (const [key, entry] of Object.entries(state.sessions)) {
        if (entry.expires <= now || key === sessionKey) delete state.sessions[key];
      }
      state.sessions[hash(newToken).toString("hex")] = {
        member: member.id,
        expires: now + SESSION_AGE * 1000,
      };
      save(path, state);
      return json({ admin: member.admin }, 200, {
        "Set-Cookie": sessionCookie(request, newToken, SESSION_AGE),
      });
    }

    if (isWrite && endpoint === "leave") {
      if (session) {
        delete state.sessions[sessionKey];
        save(path, state);
      }
      return json(null, 200, { "Set-Cookie": sessionCookie(request, "", 0) });
    }

    if (!account) throw new RequestError("Sign in with your cohort invite.", 401);
    const profiles = new Map(Object.entries(state.profiles));
    const people: Person[] = roster.map(({ code: _code, ...member }) => {
      const profile = profiles.get(member.id);
      return profile ? { ...member, profile } : member;
    });
    const groups = [
      ...new Set(roster.filter((member) => !member.admin).map((member) => member.group)),
    ];
    const progress = (group: string) =>
      progressFor(group, week, state.meetups, state.grants, state.rewarded.includes(group));

    if (isWrite && endpoint === "action") {
      const action = actionSchema.parse(input);
      switch (action.kind) {
        case "profile":
          Object.defineProperty(state.profiles, account.id, {
            value: { ...action.profile, interests: [...new Set(action.profile.interests)] },
            enumerable: true,
            configurable: true,
            writable: true,
          });
          break;
        case "log":
          if (account.admin || !profiles.has(account.id))
            throw new RequestError("Complete your member profile first.", 403);
          if (
            state.meetups.some(
              (m) => m.group === account.group && m.week === week && !m.confirmedBy,
            )
          ) {
            throw new RequestError(
              "Your group already has a meetup waiting for confirmation.",
              409,
            );
          }
          state.meetups.unshift({
            id: randomUUID(),
            group: account.group,
            title: action.title,
            createdBy: account.id,
            createdAt: now,
            week,
          });
          break;
        case "confirm": {
          const meetup = state.meetups.find((m) => m.id === action.id);
          if (
            !meetup ||
            meetup.group !== account.group ||
            account.admin ||
            meetup.createdBy === account.id ||
            !profiles.has(account.id)
          ) {
            throw new RequestError("Another member of the same group must confirm.", 403);
          }
          if (meetup.week !== week)
            throw new RequestError("This check-in expired at the end of the week.", 409);
          if (meetup.confirmedBy) return json(null);
          meetup.confirmedBy = account.id;
          meetup.confirmedAt = now;
          break;
        }
        case "cancel": {
          const meetup = state.meetups.find((m) => m.id === action.id);
          if (!meetup || meetup.confirmedBy || meetup.createdBy !== account.id) {
            throw new RequestError(
              "Only the member who logged a pending meetup can cancel it.",
              403,
            );
          }
          state.meetups = state.meetups.filter((m) => m.id !== action.id);
          break;
        }
        case "like":
        case "comment": {
          const memory = state.memories.find((m) => m.id === action.id);
          if (!memory) throw new RequestError("Memory not found.", 404);
          if (action.kind === "like") {
            const likes = new Set(memory.likes);
            if (action.liked) likes.add(account.id);
            else likes.delete(account.id);
            memory.likes = [...likes];
          } else {
            (memory.comments ??= []).push({
              id: randomUUID(),
              author: account.id,
              text: action.text,
            });
          }
          break;
        }
        case "memory": {
          const meetup = state.meetups.find((m) => m.id === action.id);
          if (!meetup?.confirmedBy || account.admin || meetup.group !== account.group) {
            throw new RequestError("Choose a confirmed meetup from your own group.", 403);
          }
          if (!action.caption && !action.photo)
            throw new RequestError("Add a caption or photo first.");
          if (state.memories.some((m) => m.meetupId === meetup.id && m.author === account.id)) {
            throw new RequestError("You already posted a memory for this meetup.", 409);
          }
          state.memories.unshift({
            id: randomUUID(),
            meetupId: meetup.id,
            author: account.id,
            caption: action.caption,
            hasPhoto: Boolean(action.photo),
            photo: action.photo,
          });
          break;
        }
        case "freeze":
        case "reward":
          if (!account.admin || !groups.includes(action.group))
            throw new RequestError("Only program heads can do that.", 403);
          if (action.kind === "freeze") {
            state.grants.push({ group: action.group, week });
          } else {
            const group = progress(action.group);
            if (!amount || group.rewarded || group.weeksMet < REWARD_WEEKS) {
              throw new RequestError("This group has no reimbursement available.", 409);
            }
            state.rewarded.push(action.group);
          }
          break;
      }
      save(path, state);
      return json(null);
    }

    if (!isWrite && endpoint.startsWith("photo/")) {
      const memory = state.memories.find((m) => m.id === endpoint.slice(6));
      const [, type, bytes] = memory?.photo.match(/^data:(image\/\w+);base64,(.+)$/) ?? [];
      if (!type || !bytes) throw new RequestError("Photo not found.", 404);
      return new Response(new Uint8Array(Buffer.from(bytes, "base64")), {
        headers: {
          "Content-Type": type,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (!isWrite && endpoint === "state") {
      const me = people.find((member) => member.id === account.id)!;
      const snapshot: Snapshot = {
        me,
        people,
        week,
        reward: amount,
        groups: groups.filter((group) => group === me.group || me.admin).map(progress),
        meetups: state.meetups.filter(
          (m) => m.confirmedBy || (m.week === week && (me.admin || me.group === m.group)),
        ),
        memories: state.memories.map(({ photo: _photo, ...memory }) => memory),
      };
      return json(snapshot);
    }
    throw new RequestError("Page not found.", 404);
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return json({ error: "Check the information and try again." }, 400);
    }
    console.error(error);
    return json({ error: "Unistreak couldn’t save or load your changes. Try again." }, 500);
  }
}
