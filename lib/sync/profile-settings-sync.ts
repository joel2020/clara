export interface ProfileSettingsPayload<SettingsShape = Record<string, unknown>> {
  profile: { id: string; name: string; coachLanguage: "es" | "en" };
  settings: SettingsShape & { profileId: string };
}

export interface ProfileSettingsWriter<SettingsShape> {
  writeProfile(profile: ProfileSettingsPayload["profile"]): Promise<boolean>;
  writeSettings(settings: SettingsShape & { profileId: string }): Promise<boolean>;
}

export type ProfileWriteFlight = { signature: string; promise: Promise<boolean> };

export async function ensureProfileSingleFlight(
  profile: ProfileSettingsPayload["profile"],
  writeProfile: (profile: ProfileSettingsPayload["profile"]) => Promise<boolean>,
  flights: Map<string, ProfileWriteFlight>,
): Promise<boolean> {
  const signature = JSON.stringify(profile);
  let flight = flights.get(profile.id);
  if (flight && flight.signature !== signature) {
    await flight.promise;
    flight = undefined;
  }
  if (!flight) {
    const promise = writeProfile(profile);
    flight = { signature, promise };
    flights.set(profile.id, flight);
    void promise.finally(() => {
      if (flights.get(profile.id)?.promise === promise) flights.delete(profile.id);
    }).catch(() => {});
  }
  return flight.promise;
}

/** Coordinates the real FK order while deduplicating concurrent profile writes. */
export async function writeProfileThenSettings<SettingsShape>(
  payload: ProfileSettingsPayload<SettingsShape>,
  writer: ProfileSettingsWriter<SettingsShape>,
  flights: Map<string, ProfileWriteFlight>,
): Promise<boolean> {
  if (payload.profile.id !== payload.settings.profileId) return false;
  if (!(await ensureProfileSingleFlight(payload.profile, writer.writeProfile, flights))) return false;
  return writer.writeSettings(payload.settings);
}
