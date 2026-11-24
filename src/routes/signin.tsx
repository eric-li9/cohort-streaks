import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Flame } from "lucide-react";
import { COHORT } from "@/lib/pilot";
import { pilotKey, pilotRequest } from "@/lib/pilot-client";

export const Route = createFileRoute("/signin")({
  head: () => ({ meta: [{ title: "Join your cohort · Unistreak" }] }),
  component: SignIn,
});

function SignIn() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { admin } = await pilotRequest<{ admin: boolean }>("join", { code });
      await client.invalidateQueries({ queryKey: pilotKey });
      await navigate({ to: admin ? "/admin" : "/", replace: true });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-center bg-accent p-8 text-accent-foreground sm:p-14">
        <div className="mb-8 flex items-center gap-2 font-display text-xl font-bold">
          <Flame className="h-6 w-6" /> Unistreak
        </div>
        <h1 className="max-w-lg font-display text-5xl font-bold sm:text-6xl">
          Make time to meet up.
        </h1>
        <p className="mt-4 text-lg">
          {COHORT.club} · {COHORT.name}
        </p>
      </section>
      <section className="flex items-center justify-center p-8">
        <form className="w-full max-w-sm space-y-5" onSubmit={submit}>
          <h2 className="font-display text-3xl font-bold">Join your cohort</h2>
          <label className="block text-sm font-semibold">
            Personal invite code
            <input
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              type="password"
              required
              maxLength={200}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-2 w-full rounded-xl border border-input bg-card px-4 py-3"
            />
          </label>
          <p className="text-sm text-muted-foreground">Use the code your program head sent you.</p>
          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="w-full rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
