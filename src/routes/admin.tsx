import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Gift, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { COHORT, REWARD_WEEKS, weekLabel, type Action } from "@/lib/pilot";
import { usePilot } from "@/lib/pilot-client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Cohort dashboard · Unistreak" }] }),
  component: Admin,
});

function Admin() {
  const { data, run } = usePilot();
  const [busy, setBusy] = useState(false);

  async function perform(action: Action) {
    setBusy(true);
    try {
      await run(action);
      toast.success(action.kind === "freeze" ? "Freeze granted." : "Reimbursement recorded.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  if (!data.me.admin)
    return (
      <main>
        <h1 className="font-display text-3xl font-bold">Program heads only</h1>
      </main>
    );

  const { groups, reward, week } = data;
  const met = groups.filter((group) => group.status === "met").length;
  const lastWeek = { met: "Met", frozen: "Used a freeze", missed: "Missed", none: "No history" };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {COHORT.club} · {COHORT.name}
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold">Cohort dashboard</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> Week of {weekLabel(week)} · {met} of {groups.length}{" "}
          groups met
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {[...groups]
          .sort((a, b) => Number(a.status === "met") - Number(b.status === "met"))
          .map((group) => {
            const pending = data.meetups.some((m) => m.group === group.id && !m.confirmedBy);
            const status =
              group.status === "met"
                ? "Met this week"
                : pending
                  ? "Awaiting confirmation"
                  : "Needs a meetup";
            return (
              <article
                key={group.id}
                className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-2xl font-bold">{group.id}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${group.status === "met" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    {status}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Last week</dt>
                    <dd className="font-semibold">{lastWeek[group.lastWeek ?? "none"]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Current streak</dt>
                    <dd className="font-semibold">{group.streak} weeks</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Freezes available</dt>
                    <dd className="font-semibold">{group.freezes}</dd>
                  </div>
                  {reward > 0 && (
                    <div>
                      <dt className="text-muted-foreground">Reimbursement</dt>
                      <dd className="font-semibold">
                        {group.rewarded
                          ? "$" + reward + " reimbursed"
                          : group.weeksMet >= REWARD_WEEKS
                            ? "$" + reward + " unlocked"
                            : `${group.weeksMet} of ${REWARD_WEEKS} meetup weeks`}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                    onClick={() => void perform({ kind: "freeze", group: group.id })}
                  >
                    <Snowflake className="h-4 w-4" /> Grant freeze
                  </button>
                  {reward > 0 && !group.rewarded && group.weeksMet >= REWARD_WEEKS && (
                    <button
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      onClick={() => void perform({ kind: "reward", group: group.id })}
                    >
                      <Gift className="h-4 w-4" /> Mark reimbursed
                    </button>
                  )}
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}
