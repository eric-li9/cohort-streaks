import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Gift, Snowflake, Users } from "lucide-react";
import { toast } from "sonner";
import { Fire } from "@/components/Fire";
import {
  INTERESTS,
  REWARD_WEEKS,
  WEEK,
  weekLabel,
  type Person,
  type Profile,
  type Snapshot,
  type Action,
} from "@/lib/pilot";
import { usePilot } from "@/lib/pilot-client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Your cohort · Unistreak" }] }),
  component: Home,
});

const panel = "rounded-3xl border border-border bg-card p-5 sm:p-7";
const actionButton =
  "rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50";
const input = "w-full rounded-xl border border-input bg-background px-3 py-2";

function ProfileForm({
  me,
  onSave,
  onCancel,
}: {
  me: Person;
  onSave: (profile: Profile) => Promise<void>;
  onCancel?: () => void;
}) {
  const [interests, setInterests] = useState(me.profile?.interests ?? []);
  const [major, setMajor] = useState(me.profile?.major ?? "");
  const [hometown, setHometown] = useState(me.profile?.hometown ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({ interests, major, hometown });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panel + " max-w-3xl space-y-5"} onSubmit={submit}>
      <div>
        <h1 className="font-display text-3xl font-bold">
          {me.profile ? "Edit your interests" : "What do you like doing?"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {me.name} · {me.role} · {me.group}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your cohort can see what you share here.
        </p>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          Pick up to five interests ({interests.length}/5)
        </legend>
        <div className="flex flex-wrap gap-2">
          {Object.keys(INTERESTS).map((interest) => (
            <button
              type="button"
              key={interest}
              aria-pressed={interests.includes(interest)}
              disabled={interests.length >= 5 && !interests.includes(interest)}
              className="rounded-full border border-border px-4 py-2 text-sm aria-pressed:border-primary aria-pressed:bg-accent disabled:opacity-40"
              onClick={() =>
                setInterests(
                  interests.includes(interest)
                    ? interests.filter((i) => i !== interest)
                    : [...interests, interest],
                )
              }
            >
              {interest}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Major (optional)
          <input
            className={input + " mt-1"}
            value={major}
            maxLength={80}
            onChange={(e) => setMajor(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Hometown (optional)
          <input
            className={input + " mt-1"}
            value={hometown}
            maxLength={80}
            onChange={(e) => setHometown(e.target.value)}
          />
        </label>
      </div>
      <div className="flex gap-4">
        <button disabled={busy || !interests.length} className={actionButton}>
          {busy ? "Saving…" : "Save profile"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm underline">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function SharedInterests({ me, people }: { me: Person; people: Person[] }) {
  const teammates = people.filter((member) => member.group === me.group && !member.admin);
  const top = (Object.keys(INTERESTS) as (keyof typeof INTERESTS)[])
    .map((interest) => ({
      interest,
      count: teammates.filter((m) => m.profile?.interests.includes(interest)).length,
    }))
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count)[0];

  return (
    <section className={panel + " space-y-4"}>
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Users className="h-5 w-5" /> Find common ground
      </h2>
      {top && (
        <div className="rounded-2xl bg-accent p-4 text-sm text-accent-foreground">
          <p>
            <strong>
              {top.count} in your group picked {top.interest}.
            </strong>{" "}
            You could {INTERESTS[top.interest]}.
          </p>
          <button
            type="button"
            className="mt-2 font-semibold underline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `Hey team! Want to ${INTERESTS[top.interest]} this week? What day works for you?`,
                );
                toast.success("Invitation copied.");
              } catch {
                toast.error("Couldn’t copy the invitation.");
              }
            }}
          >
            Copy an invite for your group chat
          </button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {people
          .filter((member) => member.id !== me.id && !member.admin)
          .sort((a, b) => Number(b.group === me.group) - Number(a.group === me.group))
          .map((member) => {
            const shared =
              member.profile?.interests.filter((interest) =>
                me.profile?.interests.includes(interest),
              ) ?? [];
            const detail = [
              member.role,
              member.group,
              member.profile?.major,
              member.profile?.hometown,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <article key={member.id} className="rounded-2xl border border-border p-4">
                <h3 className="font-semibold">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{detail}</p>
                {member.profile ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {member.profile.interests.map((interest) => (
                      <span
                        key={interest}
                        className={`rounded-full px-2.5 py-1 text-xs ${shared.includes(interest) ? "bg-accent font-semibold text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}
                      >
                        {shared.includes(interest) ? "Both like " : ""}
                        {interest}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Interests pending</p>
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
}

function MemberHome({ data, run }: { data: Snapshot; run: (action: Action) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const { me, people, groups, meetups, week, reward } = data;
  const group = groups[0]!;
  const groupMeetups = meetups.filter((m) => m.group === me.group);
  const newest = groupMeetups.find((m) => m.confirmedBy)?.id;
  const lastSeen = useRef(newest);
  const pending = groupMeetups.find((m) => !m.confirmedBy);
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "A teammate";

  useEffect(() => {
    if (newest && newest !== lastSeen.current) {
      setBurst((value) => value + 1);
      toast.success("Meetup confirmed 🔥");
    }
    lastSeen.current = newest;
  }, [newest]);

  async function perform(action: Action) {
    setBusy(true);
    try {
      await run(action);
      if (action.kind === "log") {
        setTitle("");
        toast.success("Ask someone who was there to confirm.");
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!me.profile || editing)
    return (
      <ProfileForm
        me={me}
        {...(me.profile ? { onCancel: () => setEditing(false) } : {})}
        onSave={async (profile) => {
          await run({ kind: "profile", profile });
          setEditing(false);
        }}
      />
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{me.role}</p>
          <h1 className="font-display text-4xl font-bold">{me.group}</h1>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium"
        >
          Edit profile
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className={panel + " flex flex-wrap items-center gap-4"}>
          <Fire
            status={group.status === "met" ? "lit" : group.streak ? "fading" : "out"}
            size={58}
            burst={burst}
          />
          <div className="grow">
            <h2 className="font-display text-3xl font-bold">{group.streak}-week streak</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.status === "met"
                ? "Your group met this week."
                : `Meet by Sunday, ${weekLabel(week + WEEK - 86_400_000)}.`}
            </p>
            {group.lastWeek === "frozen" && (
              <p className="mt-1 text-sm">A freeze saved your streak last week.</p>
            )}
          </div>
        </section>
        <section className={panel + " space-y-3"}>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <CalendarDays className="h-5 w-5" /> Meetup check-in
          </h2>
          {pending ? (
            <>
              <p>
                <strong>{pending.title}</strong>{" "}
                <span className="text-sm text-muted-foreground">
                  · Logged by {name(pending.createdBy)}
                </span>
              </p>
              {pending.createdBy === me.id ? (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Waiting for a teammate who attended to confirm.
                  </p>
                  <button
                    className="mt-2 text-sm underline"
                    disabled={busy}
                    onClick={() => void perform({ kind: "cancel", id: pending.id })}
                  >
                    Cancel check-in
                  </button>
                </div>
              ) : (
                <button
                  className={actionButton}
                  disabled={busy}
                  onClick={() => void perform({ kind: "confirm", id: pending.id })}
                >
                  I was there · Confirm meetup
                </button>
              )}
            </>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void perform({ kind: "log", title });
              }}
            >
              <label className="block text-sm">
                What did you do together?
                <input
                  value={title}
                  maxLength={100}
                  required
                  placeholder="Coffee after the analyst meeting"
                  className={input + " mt-1"}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <button className={actionButton} disabled={busy || !title.trim()}>
                Log a meetup
              </button>
            </form>
          )}
        </section>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={panel}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Snowflake className="h-5 w-5" /> {group.freezes}{" "}
            {group.freezes === 1 ? "freeze" : "freezes"} available
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A freeze automatically protects an active streak for a missed week.
          </p>
        </div>
        {reward > 0 && (
          <div className={panel}>
            <h2 className="flex items-center gap-2 font-semibold">
              <Gift className="h-5 w-5" /> {"$"}
              {reward} group outing reimbursement
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.rewarded
                ? "Marked reimbursed."
                : group.weeksMet >= REWARD_WEEKS
                  ? "Unlocked. Ask your program head about reimbursement."
                  : `${group.weeksMet} of ${REWARD_WEEKS} meetup weeks completed.`}
            </p>
          </div>
        )}
      </div>
      <SharedInterests me={me} people={people} />
      {newest && (
        <Link to="/feed" className="inline-block text-sm font-semibold underline">
          See the feed or add a meetup memory
        </Link>
      )}
    </div>
  );
}

function Home() {
  const { data, run } = usePilot();
  if (!data) return null;
  if (data.me.admin)
    return (
      <Link to="/admin" className={actionButton}>
        Open cohort dashboard
      </Link>
    );
  return <MemberHome key={data.me.id} data={data} run={run} />;
}
