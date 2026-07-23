"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSettings } from "@/lib/hooks/useSettings";
import { hydrateFromCloud } from "@/lib/sync/restore";
import { ensureProfile } from "@/lib/sync/supabase-sync";

// Ties the signed-in account to the data layer. The auth user id becomes the
// profile id — retiring the old minted sync codes that kept fragmenting a
// learner's progress into new profiles. Runs once after login: point the data
// layer at the account, make sure a cloud profile row exists, then pull the
// account's authoritative data (stars, streak, lessons) onto this device.
export function ProfileBinder() {
  const { required, session, user } = useAuth();
  const { settings, ready, update } = useSettings();
  const done = useRef(false);

  useEffect(() => {
    if (!required || !ready || !session || !user) return;
    if (settings.profileId === user.id) return; // already bound this account
    if (done.current) return;
    done.current = true;

    void (async () => {
      const name = settings.studentName?.trim() || user.email?.split("@")[0] || "Clara";
      // The account IS the profile now.
      await update({ profileId: user.id, studentName: name });
      await ensureProfile({ id: user.id, name, coachLanguage: settings.coachLanguage }).catch(() => {});
      // Cloud is the source of truth: pull the account's consolidated data down.
      try {
        await hydrateFromCloud(user.id);
      } catch {
        /* offline — the local cache stands in until next launch */
      }
    })();
  }, [required, ready, session, user, settings.profileId, settings.studentName, settings.coachLanguage, update]);

  return null;
}
