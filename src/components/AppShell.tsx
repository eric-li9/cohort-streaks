import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Flame, Home, LayoutGrid, Images, Moon, Sun, LogOut } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { pilotKey, pilotRequest, usePilot } from "@/lib/pilot-client";
import { COHORT } from "@/lib/pilot";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/feed", label: "Feed", icon: Images },
  { to: "/admin", label: "Admin", icon: LayoutGrid },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data, isError, refetch } = usePilot();
  const [dark, setDark] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { pathname } = useLocation();

  useEffect(() => {
    setDark(localStorage.getItem("us-dark") === "1");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  async function leave() {
    try {
      await pilotRequest("leave", {});
      await client.cancelQueries({ queryKey: pilotKey });
      client.setQueryData(pilotKey, null);
      await navigate({ to: "/signin", replace: true });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  if (pathname === "/signin") return <>{children}</>;
  if (isError)
    return (
      <main className="p-8">
        Couldn’t load the cohort.{" "}
        <button className="underline" onClick={() => void refetch()}>
          Retry
        </button>
      </main>
    );
  if (data === undefined)
    return (
      <main className="p-8" aria-live="polite">
        Loading cohort…
      </main>
    );
  if (data === null)
    return (
      <main className="mx-auto max-w-lg px-6 py-20">
        <h1 className="font-display text-4xl font-bold">Unistreak</h1>
        <p className="my-4 text-muted-foreground">Use your cohort invite to join your group.</p>
        <Link
          to="/signin"
          className="inline-block rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </main>
    );
  const items = nav.filter((item) => item.to !== "/admin" || data.me.admin);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-[10px_2px_10px_2px] bg-primary text-primary-foreground">
              <Flame className="h-5 w-5" />
            </span>
            Unistreak
          </Link>
          <span className="hidden border-l border-border pl-4 text-sm text-muted-foreground md:block">
            {COHORT.club}
          </span>
          <nav aria-label="Main navigation" className="ml-auto flex items-center gap-1">
            {items.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                className="flex items-center gap-1 rounded-full px-2 py-2 text-sm hover:bg-secondary sm:px-4"
                activeProps={{ className: "bg-accent text-accent-foreground" }}
              >
                <Icon className="hidden h-4 w-4 sm:block" />
                {label}
              </Link>
            ))}
            <button
              aria-label="Toggle dark mode"
              className="rounded-full p-2 hover:bg-secondary"
              onClick={() => {
                localStorage.setItem("us-dark", dark ? "0" : "1");
                setDark(!dark);
              }}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              aria-label="Sign out"
              className="rounded-full p-2 hover:bg-secondary"
              onClick={() => void leave()}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
