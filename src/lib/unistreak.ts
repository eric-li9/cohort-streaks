export type Cadence = "daily" | "weekly" | "biweekly" | "monthly" | "bimonthly";

export const CADENCES: { value: Cadence; label: string; days: number }[] = [
  { value: "daily", label: "Daily", days: 1 },
  { value: "weekly", label: "Weekly", days: 7 },
  { value: "biweekly", label: "Bi-weekly", days: 14 },
  { value: "monthly", label: "Monthly", days: 30 },
  { value: "bimonthly", label: "Bi-monthly", days: 60 },
];

export function cadenceDays(c: Cadence): number {
  return CADENCES.find((x) => x.value === c)!.days;
}

/** Days left before the streak breaks, given days since the last meetup. */
export function daysLeft(c: Cadence, daysSinceLast: number): number {
  return cadenceDays(c) - daysSinceLast;
}

export type StreakStatus = "lit" | "fading" | "out";
export function streakStatus(c: Cadence, daysSinceLast: number): StreakStatus {
  const left = daysLeft(c, daysSinceLast);
  if (left < 0) return "out";
  if (left <= Math.max(1, Math.floor(cadenceDays(c) * 0.25))) return "fading";
  return "lit";
}

/** Subsidy grows with streak length: $5 per meetup in a row, capped at $150. */
export function subsidyFor(streak: number): number {
  return Math.min(streak * 5, 150);
}

export type Group = {
  id: string;
  name: string;
  members: string[];
  cadence: Cadence;
  streak: number;
  meetups: number;
  daysSinceLast: number;
  freezes: number;
  nextMeetup: { title: string; when: string; where: string };
};

export const ANALYSTS = [
  "Maya Chen", "Liam Tremblay", "Sofia Rossi", "Noah Gagnon", "Aisha Khan",
  "Ethan Roy", "Chloé Bouchard", "Arjun Patel", "Emma Côté", "Daniel Kim",
  "Léa Morin", "Omar Haddad", "Grace Liu", "Félix Pelletier", "Hana Sato",
  "Lucas Fortin", "Zara Ahmed", "Owen Lavoie", "Inès Martin", "Ben Wright",
];
export const HEADS = ["Priya Nair", "Julien Dubois"];

/** Club-wide members outside the Analyst Program cohort. */
export const CLUB_MEMBERS: { name: string; role: string }[] = [
  { name: "Sofia Bergeron", role: "Co-President" },
  { name: "Marcus Chen", role: "Co-President" },
  { name: "Amara Diallo", role: "VP Events" },
  { name: "Jonah Weiss", role: "VP Sponsorships" },
  { name: "Elena Petrova", role: "VP Marketing" },
  { name: "Ravi Menon", role: "Podcast Lead" },
  { name: "Chloé Nguyen", role: "Events Committee" },
  { name: "Sam Okafor", role: "Events Committee" },
  { name: "Isabelle Roy", role: "Marketing Committee" },
  { name: "Tomás Silva", role: "Alumni Relations" },
  { name: "Nadia Rahman", role: "Newsletter Editor" },
  { name: "Felix Zhang", role: "Treasurer" },
];

export const GROUPS: Group[] = [
  { id: "g1", name: "Seed Stage", members: ANALYSTS.slice(0, 5), cadence: "weekly", streak: 6, meetups: 9, daysSinceLast: 5, freezes: 1,
    nextMeetup: { title: "Coffee + deal teardown", when: "Thu, Nov 26 · 4:00 PM", where: "Café Myriade, Mackay St" } },
  { id: "g2", name: "Series A Squad", members: ANALYSTS.slice(5, 10), cadence: "biweekly", streak: 4, meetups: 6, daysSinceLast: 11, freezes: 2,
    nextMeetup: { title: "Bagels on the mountain", when: "Sat, Nov 28 · 11:00 AM", where: "St-Viateur Bagel" } },
  { id: "g3", name: "Term Sheets", members: ANALYSTS.slice(10, 15), cadence: "monthly", streak: 2, meetups: 4, daysSinceLast: 33, freezes: 0,
    nextMeetup: { title: "Study night", when: "Not scheduled yet", where: "—" } },
  { id: "g4", name: "Cap Table Club", members: ANALYSTS.slice(15, 20), cadence: "weekly", streak: 7, meetups: 11, daysSinceLast: 3, freezes: 1,
    nextMeetup: { title: "Pho & pitch practice", when: "Tue, Dec 1 · 7:00 PM", where: "Pho Lien, Côte-des-Neiges" } },
];

export type Post = {
  id: string; groupId: string; author: string; caption: string; image?: string;
  visibility: "cohort" | "club"; reactions: number; comments: { who: string; text: string }[]; ago: string;
};

export const POSTS: Post[] = [
  { id: "p1", groupId: "g4", author: "Lucas Fortin", caption: "Streak #7 🔥 pho, pitch decks, and way too many spring rolls.",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=70", visibility: "club", reactions: 14,
    comments: [{ who: "Priya Nair", text: "Love this crew!" }], ago: "3d" },
  { id: "p2", groupId: "g1", author: "Maya Chen", caption: "Tore apart a fintech deck over lattes. Sofia found the flaw in the TAM slide 👀",
    visibility: "cohort", reactions: 6, comments: [], ago: "8d" },
  { id: "p3", groupId: "g2", author: "Ethan Roy", caption: "Mount Royal walk before midterms.",
    image: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&q=70", visibility: "club", reactions: 21,
    comments: [{ who: "Julien Dubois", text: "Fresh air = better memos" }, { who: "Grace Liu", text: "Next time invite us!" }], ago: "3w" },
];
