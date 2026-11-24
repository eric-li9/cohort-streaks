import { describe, it, expect } from "vitest";
import { cadenceDays, daysLeft, streakStatus, subsidyFor } from "./unistreak";

describe("cadence", () => {
  it("maps each cadence to its days", () => {
    expect(cadenceDays("daily")).toBe(1);
    expect(cadenceDays("weekly")).toBe(7);
    expect(cadenceDays("biweekly")).toBe(14);
    expect(cadenceDays("monthly")).toBe(30);
    expect(cadenceDays("bimonthly")).toBe(60);
  });
  it("monthly streak goes out after 30 days", () => {
    expect(daysLeft("monthly", 24)).toBe(6);
    expect(streakStatus("monthly", 31)).toBe("out");
    expect(streakStatus("monthly", 24)).toBe("fading");
    expect(streakStatus("monthly", 8)).toBe("lit");
  });
  it("subsidy caps at 150", () => {
    expect(subsidyFor(4)).toBe(20);
    expect(subsidyFor(100)).toBe(150);
  });
});
