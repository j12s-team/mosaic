import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LiveData } from "@/components/landing/LiveData";
import { AgenticLoop } from "@/components/landing/AgenticLoop";
import { WhyMosaic } from "@/components/landing/WhyMosaic";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <LiveData />
        <AgenticLoop />
        <WhyMosaic />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
