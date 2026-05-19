import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { TickerStrip } from "@/components/ticker-strip"
import { CuratedPick } from "@/components/curated-pick"
import { EventsSection } from "@/components/events-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Hero />
      <TickerStrip />
      <CuratedPick />
      <EventsSection />
      <Footer />
    </main>
  )
}
