export const INTERESTS = {
  "Board games": "play a round of board games after your next club meeting",
  Coffee: "grab coffee between classes",
  Food: "try a new lunch spot near campus",
  Fitness: "go for a walk or a workout together",
  Music: "check out a campus music event",
  Outdoors: "take a walk up Mount Royal",
  Sports: "watch a game together or play a casual pickup game",
  "Study sessions": "book a table for a study session",
  "Arts & culture": "visit a gallery or campus exhibit",
  Gaming: "organize a casual game night",
} as const;

export const REWARD_WEEKS = 3;
export const WEEK = 7 * 24 * 60 * 60 * 1000;
export const COHORT = { club: "McGill Ventures", name: "Analyst Program" };

export type Profile = { interests: string[]; major: string; hometown: string };
export type Member = { id: string; name: string; role: string; group: string; admin: boolean };
export type Person = Member & { profile?: Profile };
export type Meetup = {
  id: string;
  group: string;
  title: string;
  createdBy: string;
  createdAt: number;
  week: number;
  confirmedBy?: string;
  confirmedAt?: number;
};
export type GroupProgress = {
  id: string;
  streak: number;
  weeksMet: number;
  freezes: number;
  status: "met" | "needs-meetup";
  lastWeek: "met" | "frozen" | "missed" | null;
  rewarded: boolean;
};
export type Memory = {
  id: string;
  meetupId: string;
  author: string;
  caption: string;
  hasPhoto: boolean;
  likes?: string[];
  comments?: { id: string; author: string; text: string }[];
};
export type Snapshot = {
  me: Person;
  people: Person[];
  groups: GroupProgress[];
  meetups: Meetup[];
  memories: Memory[];
  reward: number;
  week: number;
};

export type Action =
  | { kind: "profile"; profile: Profile }
  | { kind: "log"; title: string }
  | { kind: "confirm" | "cancel"; id: string }
  | { kind: "like"; id: string; liked: boolean }
  | { kind: "comment"; id: string; text: string }
  | { kind: "memory"; id: string; caption: string; photo: string }
  | { kind: "freeze" | "reward"; group: string };

const torontoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// The UTC value encodes a Toronto calendar date, so DST does not change week lengths.
export function weekOf(time: number) {
  const date = new Date(torontoDate.format(time) + "T00:00:00Z");
  const offset = (date.getUTCDay() + 6) % 7;
  return date.getTime() - offset * 24 * 60 * 60 * 1000;
}

export function weekLabel(week: number) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(week);
}

export type Grant = { group: string; week: number };

export function progressFor(
  id: string,
  currentWeek: number,
  meetups: Meetup[],
  grants: Grant[],
  rewarded: boolean,
): GroupProgress {
  const qualifyingWeeks = new Set(
    meetups.filter((m) => m.group === id && m.confirmedBy).map((m) => m.week),
  );
  const grantWeeks = grants.filter((grant) => grant.group === id).map((grant) => grant.week);
  const firstWeek = Math.min(...qualifyingWeeks, ...grantWeeks);
  let streak = 0;
  let freezes = 1;
  let lastWeek: GroupProgress["lastWeek"] = null;

  for (let week = firstWeek; week <= currentWeek; week += WEEK) {
    freezes += grantWeeks.filter((granted) => granted === week).length;
    if (qualifyingWeeks.has(week)) {
      streak++;
      if (week < currentWeek) lastWeek = "met";
    } else if (week < currentWeek) {
      if (streak > 0 && freezes > 0) {
        freezes--;
        lastWeek = "frozen";
      } else {
        streak = 0;
        lastWeek = "missed";
      }
    }
  }

  return {
    id,
    streak,
    weeksMet: qualifyingWeeks.size,
    freezes,
    status: qualifyingWeeks.has(currentWeek) ? "met" : "needs-meetup",
    lastWeek,
    rewarded,
  };
}
