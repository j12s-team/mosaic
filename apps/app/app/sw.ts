import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";

// Cache policy (PLAN.md Phase 3, approved scope):
//   - App shell: precached (installable, loads offline).
//   - GET /api/portfolio and GET /api/baskets*: NetworkFirst — this is the
//     offline READ-ONLY portfolio. Fresh when online, last-synced when not.
//   - Every other /api/* route: NetworkOnly. Market data, quotes, thesis
//     builds, execution, mandates and signing are NEVER served from cache —
//     acting on stale prices is how users lose money.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const OFFLINE_READ_PATHS = [/^\/api\/portfolio$/, /^\/api\/baskets(\/.*)?$/];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url, request }) =>
        request.method === "GET" &&
        OFFLINE_READ_PATHS.some((re) => re.test(url.pathname)),
      handler: new NetworkFirst({
        cacheName: "mosaic-offline-read",
        networkTimeoutSeconds: 5,
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
