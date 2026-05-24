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
          <div className="rounded-xl border border-border/40 bg-card/80 dark:bg-card/40 p-8 text-center text-sm text-muted-foreground">
            Loading shared basket…
          </div>
        </main>
      }
    >
      <SharedBasketView />
    </Suspense>
  );
}
