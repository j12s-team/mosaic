import { Suspense } from "react";
import SharedBasketView from "./SharedBasketView";

// Next 15 requires that any client component which calls useSearchParams()
// be wrapped in a <Suspense> boundary at the page level, otherwise static
// generation fails with "useSearchParams() should be wrapped in a suspense
// boundary at page". This shell is a server component so the Suspense
// boundary is honored at prerender time.
export default function SharedBasketPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-6 pt-10 pb-24">
          <div className="rounded-md border border-outline-variant bg-surface-container-low dark:bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
            Loading shared basket…
          </div>
        </main>
      }
    >
      <SharedBasketView />
    </Suspense>
  );
}
