"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

// PostHog — env-gated. Without NEXT_PUBLIC_POSTHOG_KEY nothing loads and
// nothing is captured (this is a finance app; analytics is opt-in per env).
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!KEY || posthog.__loaded) return;
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: false, // captured manually on route change below
      capture_pageleave: true,
      autocapture: true,
      persistence: "localStorage+cookie",
    });
  }, []);

  useEffect(() => {
    if (!KEY || !pathname) return;
    posthog.capture("$pageview");
  }, [pathname]);

  return null;
}
