// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handlePilot } from "./pilot.server";
import { weekOf, type Snapshot } from "./pilot";

const origin = "http://localhost:3000";
const directory = mkdtempSync(join(tmpdir(), "unistreak-test-"));
const code = (id: string) => `test-invite-only-for-${id}-123456`;

const roster = [
  { id: "mia", name: "Mia", role: "Analyst", group: "Seed" },
  { id: "ben", name: "Ben", role: "Analyst", group: "Seed" },
  { id: "eli", name: "Eli", role: "Analyst", group: "Series A" },
  { id: "head", name: "Priya", role: "Program head", group: "Leadership", admin: true },
].map((member) => ({ ...member, code: code(member.id) }));

function request(endpoint: string, cookie = "", payload?: unknown) {
  return handlePilot(
    new Request(origin + "/api/pilot/" + endpoint, {
      headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
      ...(payload === undefined ? {} : { method: "POST", body: JSON.stringify(payload) }),
    }),
  );
}

async function signIn(id: string) {
  const response = await request("join", "", { code: code(id) });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";")[0]!;
}

async function snapshot(cookie: string) {
  const response = await request("state", cookie);
  expect(response.status).toBe(200);
  return (await response.json()) as Snapshot;
}

afterEach(() => {
  rmSync(directory, { force: true, recursive: true });
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("cohort pilot", () => {
  it("uses Monday in Toronto even across daylight saving time", () => {
    expect(weekOf(Date.parse("2025-03-10T03:59:59Z"))).toBe(Date.parse("2025-03-03"));
    expect(weekOf(Date.parse("2025-03-10T04:00:00Z"))).toBe(Date.parse("2025-03-10"));
  });

  it("shares profiles, confirms distinct meetup weeks, uses a freeze, and limits rewards to program heads", async () => {
    vi.stubEnv("UNISTREAK_ROSTER", JSON.stringify(roster));
    vi.stubEnv("UNISTREAK_DATA", join(directory, "state.json"));
    vi.stubEnv("UNISTREAK_ORIGIN", origin);
    vi.stubEnv("UNISTREAK_REWARD", "25");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-04T16:00:00Z"));
    const mia = await signIn("mia");
    const ben = await signIn("ben");
    const eli = await signIn("eli");
    const head = await signIn("head");
    expect((await request("state")).status).toBe(401);
    expect((await request("action", mia, { kind: "log", title: "Coffee" })).status).toBe(403);
    for (const member of [mia, ben, eli]) {
      expect(
        (
          await request("action", member, {
            kind: "profile",
            profile: { interests: ["Coffee"], major: "Finance", hometown: "" },
          })
        ).status,
      ).toBe(200);
    }
    expect(
      (await snapshot(ben)).people.find((person) => person.id === "mia")?.profile?.interests,
    ).toEqual(["Coffee"]);
    expect((await request("action", mia, { kind: "freeze", group: "Seed" })).status).toBe(403);

    async function confirmMeetup() {
      expect((await request("action", mia, { kind: "log", title: "Coffee" })).status).toBe(200);
      const pending = (await snapshot(ben)).meetups.find((m) => !m.confirmedBy)!;
      const action = { kind: "confirm", id: pending.id };
      expect((await snapshot(eli)).meetups.some((m) => m.id === pending.id)).toBe(false);
      expect((await request("action", mia, action)).status).toBe(403);
      expect((await request("action", eli, action)).status).toBe(403);
      expect((await request("action", ben, action)).status).toBe(200);
      expect((await request("action", ben, action)).status).toBe(200);
      return pending.id;
    }

    const meetup = await confirmMeetup();
    await confirmMeetup();
    expect((await snapshot(mia)).groups[0]).toMatchObject({
      streak: 1,
      weeksMet: 1,
      status: "met",
      freezes: 1,
    });
    expect(
      (
        await request("action", mia, {
          kind: "memory",
          id: meetup,
          caption: "Good coffee",
          photo: "data:image/png;base64,iVBORw0KGgo=",
        })
      ).status,
    ).toBe(200);
    const memory = (await snapshot(eli)).memories[0]!;
    expect(memory).toMatchObject({ caption: "Good coffee", hasPhoto: true });
    expect(memory).not.toHaveProperty("photo");
    expect((await request("photo/" + memory.id)).status).toBe(401);
    expect((await request("photo/" + memory.id, eli)).headers.get("content-type")).toBe(
      "image/png",
    );

    vi.setSystemTime(new Date("2025-03-18T16:00:00Z"));
    expect((await snapshot(mia)).groups[0]).toMatchObject({
      streak: 1,
      weeksMet: 1,
      freezes: 0,
      lastWeek: "frozen",
    });
    await confirmMeetup();
    expect((await request("action", head, { kind: "reward", group: "Seed" })).status).toBe(409);
    vi.setSystemTime(new Date("2025-03-25T16:00:00Z"));
    await confirmMeetup();
    expect((await snapshot(head)).groups[0]).toMatchObject({
      streak: 3,
      weeksMet: 3,
      rewarded: false,
    });
    expect((await request("action", mia, { kind: "reward", group: "Seed" })).status).toBe(403);
    expect((await request("action", head, { kind: "reward", group: "Seed" })).status).toBe(200);
    expect((await request("action", head, { kind: "reward", group: "Seed" })).status).toBe(409);
    expect((await request("action", head, { kind: "freeze", group: "Seed" })).status).toBe(200);
    expect((await snapshot(mia)).groups[0]).toMatchObject({ rewarded: true, freezes: 1 });
    vi.setSystemTime(new Date("2025-04-15T16:00:00Z"));
    const renewed = await signIn("mia");
    expect((await snapshot(renewed)).groups[0]).toMatchObject({
      streak: 0,
      weeksMet: 3,
      lastWeek: "missed",
    });

    await request("leave", renewed, {});
    expect((await request("state", renewed)).status).toBe(401);
  });
});
