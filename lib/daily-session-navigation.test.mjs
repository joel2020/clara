import test from "node:test";
import assert from "node:assert/strict";
import { activityHref } from "../components/daily-session/navigation.ts";

const speak = {
  id: "speak", kind: "speak", title: { en: "Speak", es: "Habla" }, targetIds: [], sourceId: "th",
  reason: "weak-sound", estimatedMinutes: 2, status: "active",
};

test("inline pronunciation recovery never navigates to shadow mode", () => {
  assert.equal(activityHref({ ...speak, pronunciation: { mode: "scored", game: "sound-sprint", selectionSource: "latam-prior", targets: [] } }, "2026-08-09"), null);
  assert.match(activityHref(speak, "2026-08-09"), /^\/shadow\?/);
});
