import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StreakStatus } from "@/lib/unistreak";

export function Fire({ status, size = 48, burst }: { status: StreakStatus; size?: number; burst?: number }) {
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size * 1.6, height: size * 1.6 }}>
      {status !== "out" && <span className="absolute inset-0 rounded-full bg-fire-glow/30 blur-xl" />}
      <Flame key={burst} style={{ width: size, height: size }}
        className={cn("relative", status === "out" ? "text-muted-foreground" : "fill-fire-glow text-fire animate-flicker",
          status === "fading" && "opacity-60", burst ? "animate-ignite" : "")} />
      {burst ? [0, 1, 2].map((i) => (
        <span key={`${burst}-${i}`} className="absolute h-1.5 w-1.5 rounded-full bg-fire animate-rise"
          style={{ left: `${35 + i * 15}%`, top: "30%", animationDelay: `${i * 0.15}s` }} />
      )) : null}
    </span>
  );
}
