"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db/dexie";
import { repo } from "@/lib/db";
import { CATEGORIES } from "@/lib/content/categories";
import type { Lesson, LessonKind, PracticeItem } from "@/lib/db/types";

// Lets the instructor add custom mini-lessons. Words are entered fast, one per
// line as `text | ipa | mouth hint` (ipa and hint optional). The lesson shows up
// in the learner's list immediately and feeds the same SRS + dashboard.

const KINDS: { value: LessonKind; label: string }[] = [
  { value: "sound-focus", label: "Words" },
  { value: "phrase", label: "Phrases" },
];

export function CustomLessonBuilder() {
  const custom = useLiveQuery(() => (db ? db.customLessons.orderBy("order").toArray() : []), []);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [kind, setKind] = useState<LessonKind>("sound-focus");
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = parseItems(raw, categoryId, kind);

  const save = async () => {
    if (!title.trim()) {
      toast.error("Give the lesson a title.");
      return;
    }
    if (parsed.length === 0) {
      toast.error("Add at least one word or phrase.");
      return;
    }
    setSaving(true);
    const id = `custom-${slug(title)}-${Date.now().toString(36)}`;
    const lesson: Lesson = {
      id,
      title: title.trim(),
      subtitle: "Custom",
      description: "Added in Instructor mode.",
      kind,
      categoryIds: [categoryId],
      items: parsed.map((p, i) => ({ ...p, id: `${id}:${i}` })),
      custom: true,
      order: 100 + (custom?.length ?? 0),
    };
    await repo.saveCustomLesson(lesson);
    setTitle("");
    setRaw("");
    setSaving(false);
    toast.success(`Added “${lesson.title}” (${lesson.items.length} items).`);
  };

  const remove = async (id: string, name: string) => {
    await repo.deleteCustomLesson(id);
    toast.success(`Removed “${name}”.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold">
          <Plus className="size-5 text-primary" />
          New mini-lesson
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="lesson-title">Title</Label>
            <Input
              id="lesson-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Restaurant words"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="lesson-kind">Type</Label>
            <select
              id="lesson-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as LessonKind)}
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="lesson-cat">Sound category</Label>
            <select
              id="lesson-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="lesson-items">
              {kind === "phrase" ? "Phrases" : "Words"} — one per line, optional{" "}
              <code className="rounded bg-muted px-1 text-xs">text | ipa | mouth hint</code>
            </Label>
            <Textarea
              id="lesson-items"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={5}
              placeholder={"water | /ˈwɔːtər/ | tap the t softly\nbottle\nlittle"}
              className="mt-1.5 font-mono text-sm"
            />
            {parsed.length > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">{parsed.length} items ready.</p>
            )}
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="mt-4 gap-2 rounded-full">
          <Plus className="size-4" />
          Save lesson
        </Button>
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 font-extrabold">
          <BookOpen className="size-5 text-primary" />
          Your custom lessons
        </h3>
        {!custom || custom.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. Anything you add appears in her lesson list.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {custom.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{l.title}</p>
                  <p className="text-xs text-muted-foreground">{l.items.length} items</p>
                </div>
                <Badge variant="secondary">{l.kind === "phrase" ? "Phrases" : "Words"}</Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(l.id, l.title)}
                  aria-label={`Delete ${l.title}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function parseItems(raw: string, categoryId: string, kind: LessonKind): Omit<PracticeItem, "id">[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [text, ipa, hint] = line.split("|").map((s) => s.trim());
      return {
        text,
        ipa: ipa || "",
        mouthHint: hint || "Listen closely, then match the sound.",
        kind: kind === "phrase" ? ("phrase" as const) : ("word" as const),
        categoryId,
        phoneme: "custom",
      };
    })
    .filter((i) => i.text.length > 0);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "lesson";
}
