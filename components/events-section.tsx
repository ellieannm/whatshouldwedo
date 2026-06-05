"use client"

import { useEffect, useState } from "react"
import { EventCard } from "./event-card"
import {
  eventMatchesTimeFilter,
  formatEventDateRange,
} from "@/lib/melbourne-dates"
import { supabase } from "@/lib/supabase"

const vibeFilters = [
  { label: "Late night", value: "late-night", icon: "🌙" },
  { label: "Low key", value: "low-key", icon: "🌿" },
  { label: "High energy", value: "high-energy", icon: "⚡" },
  { label: "Free or cheap", value: "free-cheap", icon: "💸" },
  { label: "Solo-friendly", value: "solo", icon: "🧍" },
  { label: "Good for groups", value: "groups", icon: "👥" },
  { label: "Date night", value: "date-night", icon: "🌹" },
]

const timeFilters = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "Weekend", value: "weekend" },
  { label: "This Month", value: "month" },
  { label: "Pick a Date", value: "date" },
]

type TimeFilter = "today" | "week" | "weekend" | "month" | "date"
type VibeFilter = (typeof vibeFilters)[number]["value"]

type Event = {
  id: string
  title: string
  description: string
  category: string
  date: string
  location: string
  venue_name: string
  venue_suburb: string
  image_url: string
  source_url: string
  start_datetime: string
  end_datetime: string
  vibes: string[]
  votes: number
  vibe_description: string
}

async function generateVibeDescription(event: Event): Promise<string | null> {
  const response = await fetch("/api/generate-vibe-description", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: event.id,
      title: event.title,
      description: event.description,
      category: event.category,
      venue_name: event.venue_name,
      venue_suburb: event.venue_suburb,
      vibes: event.vibes,
    }),
  })

  if (!response.ok) return null

  const payload = (await response.json()) as { description?: string }
  return payload.description?.trim() || null
}

function mapRowToEvent(row: Record<string, unknown>): Event {
  return {
    id: String(row.id),
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    category: (row.category as string) ?? "",
    start_datetime: (row.start_datetime as string) ?? "",
    end_datetime: (row.end_datetime as string) ?? "",
          date: formatEventDateRange(
            String(row.start_datetime ?? ""),
            String(row.end_datetime ?? "")
          ),
    venue_name: (row.venue_name as string) ?? "",
    venue_suburb: (row.venue_suburb as string) ?? "",
    location: (row.venue_suburb as string) ?? (row.venue_name as string) ?? "",
    image_url: (row.image_url as string) ?? "",
    source_url: (row.source_url as string) ?? "",
    vibes: Array.isArray(row.vibes)
      ? (row.vibes as unknown[]).filter(
          (v): v is string => typeof v === "string" && v.length > 0
        )
      : [],
    votes: Number(row.votes) || 0,
    vibe_description: (row.vibe_description as string) ?? "",
  }
}

function eventMatchesSearch(event: Event, query: string) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true

  const haystack = [
    event.title,
    event.venue_name,
    event.venue_suburb,
    event.description,
    event.location,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(trimmed)
}

export function EventsSection() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>("month")
  const [pickedDate, setPickedDate] = useState("")
  const [activeVibes, setActiveVibes] = useState<VibeFilter[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    async function fetchEvents() {
      const { data, error: fetchError } = await supabase
        .from("events")
        .select(
          "id,title,description,category,start_datetime,end_datetime,venue_name,venue_suburb,image_url,source_url,vibes,votes,vibe_description,status"
        )
        .or("status.eq.approved,status.is.null")

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      const mapped = (data ?? []).map((row) => mapRowToEvent(row))
      setEvents(mapped)
      setLoading(false)

      const missingVibeDescription = mapped.filter((event) => !event.vibe_description.trim())
      for (const event of missingVibeDescription) {
        const description = await generateVibeDescription(event)
        if (!description) continue

        setEvents((current) =>
          current.map((item) =>
            item.id === event.id ? { ...item, vibe_description: description } : item
          )
        )
      }
    }

    fetchEvents()
  }, [])

  const handleVotesChange = (eventId: string, newVotes: number) => {
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId ? { ...event, votes: newVotes } : event
      )
    )
  }

  const toggleVibe = (vibe: VibeFilter) => {
    setActiveVibes((prev) =>
      prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]
    )
  }

  const filteredEvents = events.filter((event) => {
    const passesTimeFilter =
      activeTimeFilter === "date" && !pickedDate
        ? true
        : eventMatchesTimeFilter(
            event.start_datetime,
            activeTimeFilter,
            event.end_datetime,
            activeTimeFilter === "date" ? pickedDate : undefined
          )

    const passesVibeFilter =
      activeVibes.length === 0 ||
      activeVibes.some((vibe) => event.vibes.includes(vibe))

    const passesSearch = eventMatchesSearch(event, searchQuery)

    return passesTimeFilter && passesVibeFilter && passesSearch
  })

  const sortedEvents = [...filteredEvents].sort((a, b) => b.votes - a.votes)

  return (
    <section className="py-16 md:py-24 px-4 md:px-8 lg:px-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
        <h2 className="font-[var(--font-display)] text-3xl md:text-4xl lg:text-5xl font-black text-foreground uppercase tracking-tight">
          What&apos;s On
        </h2>

        <div className="flex flex-col items-start gap-3">
          <div className="flex flex-wrap gap-2">
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
          {activeTimeFilter === "date" ? (
            <input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              className="px-3 py-2 text-xs uppercase tracking-wide font-medium bg-transparent text-foreground border border-foreground/40 focus:outline-none focus:border-foreground rounded-none"
            />
          ) : null}
        </div>
      </div>

      <div className="mb-12">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-4 font-medium">
          Search
        </p>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Title, venue, suburb, description…"
          className="w-full max-w-xl px-3 py-2 mb-8 text-xs uppercase tracking-wide font-medium bg-transparent text-foreground border border-foreground/40 placeholder:text-muted-foreground placeholder:uppercase focus:outline-none focus:border-foreground rounded-none"
        />

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
      ) : sortedEvents.length > 0 ? (
        <div className="grid grid-cols-1 items-start gap-8 overflow-visible md:grid-cols-2 md:gap-10 lg:grid-cols-3 [&>article]:min-h-0 [&>article]:overflow-visible">
          {sortedEvents.map((event) => (
            <EventCard
              key={event.id}
              {...event}
              onVotesChange={handleVotesChange}
            />
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
                setPickedDate("")
                setSearchQuery("")
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
