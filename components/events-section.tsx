"use client"

import { useEffect, useState } from "react"
import { EventCard } from "./event-card"
import { eventMatchesTimeFilter, formatEventDisplayDate } from "@/lib/melbourne-dates"
import { supabase } from "@/lib/supabase"

const vibeFilters = [
  { label: "Late night", value: "late-night", icon: "🌙" },
  { label: "Low key", value: "low-key", icon: "🌿" },
  { label: "High energy", value: "high-energy", icon: "⚡" },
  { label: "Free or cheap", value: "free-cheap", icon: "💸" },
  { label: "Spontaneous", value: "spontaneous", icon: "🎲" },
  { label: "Solo-friendly", value: "solo", icon: "🧍" },
  { label: "Good for groups", value: "groups", icon: "👥" },
]

const timeFilters = [
  { label: "This Week", value: "week" },
  { label: "Weekend", value: "weekend" },
  { label: "This Month", value: "month" },
]

type TimeFilter = "week" | "weekend" | "month"
type VibeFilter = (typeof vibeFilters)[number]["value"]

type Event = {
  id: string
  title: string
  category: string
  date: string
  location: string
  image_url: string
  source_url: string
  start_datetime: string
  end_datetime: string
  vibes: string[]
}

export function EventsSection() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>("month")
  const [activeVibes, setActiveVibes] = useState<VibeFilter[]>([])

  useEffect(() => {
    async function fetchEvents() {
      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*")

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setEvents(
        (data ?? []).map((row) => ({
          id: String(row.id),
          title: row.title,
          category: row.category,
          start_datetime: row.start_datetime ?? "",
          end_datetime: row.end_datetime ?? "",
          date: formatEventDisplayDate(String(row.start_datetime ?? "")),
          location: row.venue_suburb ?? row.venue_name ?? "",
          image_url: row.image_url ?? "",
          source_url: row.source_url ?? "",
          vibes: row.vibe ? [row.vibe] : [],
        }))
      )
      setLoading(false)
    }

    fetchEvents()
  }, [])

  const toggleVibe = (vibe: VibeFilter) => {
    setActiveVibes((prev) =>
      prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]
    )
  }

  const filteredEvents = events.filter((event) => {
    const passesTimeFilter = eventMatchesTimeFilter(
      event.start_datetime,
      activeTimeFilter,
      event.end_datetime
    )

    const passesVibeFilter =
      activeVibes.length === 0 ||
      activeVibes.some((vibe) => event.vibes.includes(vibe))

    return passesTimeFilter && passesVibeFilter
  })

  return (
    <section className="py-16 md:py-24 px-4 md:px-8 lg:px-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
        <h2 className="font-[var(--font-display)] text-3xl md:text-4xl lg:text-5xl font-black text-foreground uppercase tracking-tight">
          What&apos;s On
        </h2>

        <div className="flex gap-2">
          {timeFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveTimeFilter(filter.value as TimeFilter)}
              className={`px-4 py-2 text-xs uppercase tracking-widest font-medium transition-colors ${
                activeTimeFilter === filter.value
                  ? "bg-primary text-[#e5e7d4]"
                  : "bg-transparent text-foreground border border-foreground hover:bg-foreground hover:text-background"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-12">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-4 font-medium">
          Filter by vibe
        </p>
        <div className="flex flex-wrap gap-2">
          {vibeFilters.map((vibe) => (
            <button
              key={vibe.value}
              onClick={() => toggleVibe(vibe.value)}
              className={`px-3 py-2 text-xs uppercase tracking-wide font-medium transition-all flex items-center gap-2 ${
                activeVibes.includes(vibe.value)
                  ? "bg-foreground text-background"
                  : "bg-transparent text-foreground border border-foreground/40 hover:border-foreground"
              }`}
            >
              <span>{vibe.icon}</span>
              <span>{vibe.label}</span>
            </button>
          ))}
          {activeVibes.length > 0 && (
            <button
              onClick={() => setActiveVibes([])}
              className="px-3 py-2 text-xs uppercase tracking-wide font-medium text-primary hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-center py-16 text-muted-foreground">Loading events…</p>
      ) : error ? (
        <p className="text-center py-16 text-destructive">{error}</p>
      ) : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} {...event} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg mb-4">
            {events.length === 0
              ? "No events yet"
              : "No events match your filters"}
          </p>
          {events.length > 0 && (
            <button
              onClick={() => {
                setActiveVibes([])
                setActiveTimeFilter("month")
              }}
              className="text-primary underline underline-offset-4 hover:opacity-70 transition-opacity"
            >
              Show all events
            </button>
          )}
        </div>
      )}
    </section>
  )
}
