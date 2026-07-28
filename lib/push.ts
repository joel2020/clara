"use client";

// Client side of daily reminders. iOS supports web push from 16.4, but ONLY
// for PWAs installed to the home screen — `supported()` reflects what THIS
// browser context can do right now, and the settings UI explains the
// install-first story when needed.

import { authHeaders } from "@/lib/auth-client";

export type PushState = "unsupported" | "not_configured" | "default" | "granted" | "denied";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function pushServerEnabled(): Promise<boolean> {
  try {
    const r = await fetch("/api/push");
    if (!r.ok) return false;
    const d = (await r.json()) as { enabled?: boolean };
    return Boolean(d.enabled);
  } catch {
    return false;
  }
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (!(await pushServerEnabled())) return "not_configured";
  return Notification.permission as PushState;
}

export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return Boolean(sub);
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ask permission, subscribe, and register with the server. Throws on failure.
 *  The server binds the subscription to the signed-in account, so no profile id
 *  travels in the body. */
export async function enablePush(lang: "es" | "en"): Promise<void> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("no_key");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission);
  const reg = await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ subscription: subscription.toJSON(), lang }),
  });
  if (!res.ok) throw new Error("server");
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}
