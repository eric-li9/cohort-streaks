import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Action, Snapshot } from "./pilot";

const key = ["cohort"];

export async function pilotRequest<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(
    "/api/pilot/" + path,
    payload === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data as T;
}

export function usePilot() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: key,
    enabled: typeof window !== "undefined",
    retry: false,
    refetchInterval: 5000,
    queryFn: async () => {
      const response = await fetch("/api/pilot/state");
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("Couldn’t load the cohort.");
      return (await response.json()) as Snapshot;
    },
  });

  async function run(action: Action) {
    await pilotRequest("action", action);
    await client.invalidateQueries({ queryKey: key });
  }

  return { ...query, run };
}

export const pilotKey = key;
