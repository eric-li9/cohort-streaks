import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Heart, Images } from "lucide-react";
import { toast } from "sonner";
import { usePilot } from "@/lib/pilot-client";
import type { Action, Meetup, Memory, Person, Snapshot } from "@/lib/pilot";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Cohort feed · Unistreak" }] }),
  component: Feed,
});

const panel = "space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6";
const input = "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2";

async function encodePhoto(file: File | undefined) {
  if (!file) return "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn’t process this photo.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.78);
  } finally {
    bitmap.close();
  }
}

function MemoryForm({
  meetups,
  run,
}: {
  meetups: Meetup[];
  run: (action: Action) => Promise<void>;
}) {
  const [id, setId] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File>();

  async function post(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    try {
      await run({ kind: "memory", id, caption, photo: await encodePhoto(file) });
      setId("");
      setCaption("");
      setFile(undefined);
      form.reset();
      toast.success("Memory shared with your cohort.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panel} onSubmit={post}>
      <h2 className="font-display text-2xl font-bold">Share a meetup memory</h2>
      <label className="block text-sm">
        Confirmed meetup
        <select
          value={id}
          required
          className={input}
          onChange={(event) => setId(event.target.value)}
        >
          <option value="">Choose a meetup</option>
          {meetups.map((meetup) => (
            <option key={meetup.id} value={meetup.id}>
              {meetup.title} ·{" "}
              {new Date(meetup.createdAt).toLocaleDateString("en-CA", {
                timeZone: "America/Toronto",
              })}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Caption (optional)
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={400}
          rows={2}
          className={input}
        />
      </label>
      <label className="block text-sm">
        Photo (optional)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={input}
          onChange={(event) => setFile(event.target.files?.[0])}
        />
      </label>
      <button
        disabled={busy || !id || (!caption.trim() && !file)}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Posting…" : "Post to cohort"}
      </button>
    </form>
  );
}

function Reactions({
  memory,
  me,
  people,
  run,
}: {
  memory: Memory;
  me: Person;
  people: Person[];
  run: (action: Action) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const liked = memory.likes?.includes(me.id) ?? false;

  async function react(action: Action) {
    setBusy(true);
    try {
      await run(action);
      if (action.kind === "comment") setText("");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <button
        type="button"
        aria-label="Like memory"
        aria-pressed={liked}
        disabled={busy}
        className="flex items-center gap-1.5 text-sm"
        onClick={() => void react({ kind: "like", id: memory.id, liked: !liked })}
      >
        <Heart className={liked ? "h-4 w-4 fill-current text-primary" : "h-4 w-4"} />{" "}
        {memory.likes?.length ?? 0}
      </button>
      {memory.comments?.map((comment) => (
        <p key={comment.id} className="break-words text-sm">
          <strong>
            {people.find((person) => person.id === comment.author)?.name ?? "Cohort member"}
          </strong>{" "}
          {comment.text}
        </p>
      ))}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void react({ kind: "comment", id: memory.id, text });
        }}
      >
        <input
          aria-label="Comment"
          placeholder="Add a comment"
          className={input}
          required
          maxLength={250}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button
          disabled={busy || !text.trim()}
          className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function CohortFeed({ data, run }: { data: Snapshot; run: (action: Action) => Promise<void> }) {
  const confirmed = data.meetups.filter((m) => m.confirmedBy);
  const available = confirmed.filter(
    (m) =>
      m.group === data.me.group &&
      !data.memories.some((memory) => memory.meetupId === m.id && memory.author === data.me.id),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="flex items-center gap-3 font-display text-4xl font-bold">
        <Images className="h-7 w-7" /> Cohort feed
      </h1>
      {!data.me.admin && available.length > 0 && <MemoryForm meetups={available} run={run} />}
      {data.memories.length === 0 && (
        <p className="text-muted-foreground">
          No meetup memories yet. Members can share a photo or caption after their group confirms a
          meetup.
        </p>
      )}
      {data.memories.map((memory) => {
        const meetup = confirmed.find((m) => m.id === memory.meetupId);
        const author = data.people.find((p) => p.id === memory.author);
        return (
          <article key={memory.id} className={panel}>
            <div>
              <h2 className="font-display text-2xl font-bold">{meetup?.title ?? "Meetup"}</h2>
              <p className="text-sm text-muted-foreground">
                {author?.name ?? "Cohort member"} · {meetup?.group}
              </p>
            </div>
            {memory.caption && <p className="whitespace-pre-wrap">{memory.caption}</p>}
            {memory.hasPhoto && (
              <img
                loading="lazy"
                className="max-h-[32rem] w-full rounded-xl object-contain"
                src={`/api/pilot/photo/${memory.id}`}
                alt={`Photo from ${meetup?.title ?? "a cohort meetup"}`}
              />
            )}
            <Reactions memory={memory} me={data.me} people={data.people} run={run} />
          </article>
        );
      })}
    </div>
  );
}

function Feed() {
  const { data, run } = usePilot();
  return data ? <CohortFeed key={data.me.id} data={data} run={run} /> : null;
}
