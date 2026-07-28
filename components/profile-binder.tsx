"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSettings } from "@/lib/hooks/useSettings";
import { hydrateFromCloud, restoreProfile, isFreshLocalData } from "@/lib/sync/restore";
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
      // Cloud is the source of truth. Pull the account's consolidated data first
      // (this also seeds player/progress into Dexie) and APPLY its settings —
      // including the restored name and onboarding/placement — so a returning
      // learner on a fresh device/origin isn't treated as brand new.
      //
      // On a genuinely fresh device (empty account database) the hydrate path
      // deliberately skips attempt history, which silently under-counted
      // insights and weak-sound rankings after a device change (audit P1). A
      // fresh database therefore does the FULL restore — attempts included —
      // before the cheap hydrate applies settings on top.
      const fresh = await isFreshLocalData().catch(() => false);
      if (fresh) await restoreProfile(user.id).catch(() => null);
      const cloud = await hydrateFromCloud(user.id).catch(() => null);
      const patch = cloud?.settingsPatch ?? {};
      const name =
        patch.studentName?.trim() ||
        settings.studentName?.trim() ||
        user.email?.split("@")[0] ||
        "Clara";
      // The account IS the profile now; cloud values win over local/email defaults.
      await update({ ...patch, profileId: user.id, studentName: name });
      await ensureProfile({ id: user.id, name, coachLanguage: patch.coachLanguage ?? settings.coachLanguage }).catch(() => {});
    })();
  }, [required, ready, session, user, settings.profileId, settings.studentName, settings.coachLanguage, update]);

  return null;
}
