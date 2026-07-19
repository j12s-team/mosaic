import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { LoopSection } from "@/components/landing/LoopSection";
import { LiveData } from "@/components/landing/LiveData";
import { TrustSection } from "@/components/landing/TrustSection";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <div className="brand-root min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <section className="mx-auto max-w-content px-4 sm:px-6">
          <div className="brand-panel-inset overflow-hidden p-2 sm:p-4">
            <ProductPreview />
          </div>
          <p className="brand-eyebrow mt-3 text-center">
            self-playing preview — thesis → basket → backtest → execute
          </p>
        </section>
        <LoopSection />
        <section className="mx-auto max-w-content px-4 sm:px-6" id="data">
          <p className="brand-eyebrow">proof, not promises</p>
          <h2 className="brand-wordmark mt-4 text-2xl sm:text-4xl">
            LIVE <span className="brand-gradient-text">DATA</span>
          </h2>
          <div className="brand-panel mt-8 overflow-hidden p-2 sm:p-4">
            <LiveData />
          </div>
        </section>
        <TrustSection />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
