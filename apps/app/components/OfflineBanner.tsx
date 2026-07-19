"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shown whenever the browser is offline. The PWA layer serves last-synced
 * portfolio/basket reads from cache (see app/sw.ts); everything that prices
 * or moves money is network-only, so we say so plainly.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-warning-container px-4 py-2 text-center text-xs font-medium text-on-warning-container">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      Offline — showing last-synced data. Live prices, execution and signing are unavailable.
    </div>
  );
}
