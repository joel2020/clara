"use client";

import { useEffect, useState } from "react";

// A cinematic scene loop with graceful degradation. Plays a muted, looping,
// inline video (WebM then MP4); under prefers-reduced-motion or Data Saver it
// shows only the poster still. Files live in public/scenes/ as
// <base>.webm / <base>.mp4 / <base>-poster.jpg. The hand-built SVG scenes remain
// the guaranteed-instant fallback layer beneath any use of this.

export function SceneVideo({
  base,
  className,
  poster,
  alt = "",
}: {
  /** e.g. "/scenes/bg-home-medellin-16x9" */
  base: string;
  className?: string;
  poster?: string;
  alt?: string;
}) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    // Decide on the client so SSR and the device agree (no hydration mismatch).
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const saveData =
      (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData ?? false;
    const timer = setTimeout(() => setPlay(!reduce && !saveData), 0);
    return () => clearTimeout(timer);
  }, []);

  const posterSrc = poster ?? `${base}-poster.jpg`;

  if (!play) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={posterSrc} alt={alt} aria-hidden={!alt} className={className} />;
  }

  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={posterSrc}
      aria-hidden={!alt}
      className={className}
    >
      <source src={`${base}.webm`} type="video/webm" />
      <source src={`${base}.mp4`} type="video/mp4" />
    </video>
  );
}
