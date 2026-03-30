"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdSenseUnitProps {
  /** Ad slot ID from your AdSense dashboard (the number, not the full ID) */
  slot: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  className?: string;
}

/**
 * Renders a single Google AdSense ad unit.
 *
 * Requires NEXT_PUBLIC_ADSENSE_PUBLISHER_ID in your env (e.g. "ca-pub-1234567890").
 * Returns null silently if the env var is not set — safe for dev and staging.
 *
 * The global AdSense script is loaded once in app/layout.tsx via next/script.
 * Each instance of this component pushes one unit to the adsbygoogle queue.
 */
export function AdSenseUnit({ slot, format = "auto", className }: AdSenseUnitProps) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    // Guard: AdSense marks processed units with data-ad-status="done"
    if (ref.current?.getAttribute("data-ad-status") === "done") return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense script not yet loaded — it will process queued units on load
    }
  }, []);

  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;
  if (!publisherId || !slot) return null;

  return (
    <div className={className} aria-label="Advertisement">
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
