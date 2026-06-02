"use client"

import { useEffect, useState } from "react"
import {
  MELBOURNE_TZ,
  parseUtcStartDatetime,
  toMelbourneDateKey,
} from "@/lib/melbourne-dates"
import { supabase } from "@/lib/supabase"

type CuratedEvent = {
  title: string
  description: string
  start_datetime: string
  end_datetime: string
  venue_name: string
  venue_suburb: string
  image_url: string
  source_url: string
  category: string
  vibes: string[]
}

function formatCuratedDateRange(startDatetime: string, endDatetime: string): string {
  const start = parseUtcStartDatetime(startDatetime)
  const end = parseUtcStartDatetime(endDatetime)
  if (!start) return ""

  const formatDayMonth = (date: Date) =>
    new Intl.DateTimeFormat("en-AU", {
      timeZone: MELBOURNE_TZ,
      day: "numeric",
      month: "short",
    }).format(date)

  const startFormatted = formatDayMonth(start)
  if (!end) return startFormatted

  const startKey = toMelbourneDateKey(start)
  const endKey = toMelbourneDateKey(end)
  if (startKey === endKey) return startFormatted

  return `${startFormatted} — ${formatDayMonth(end)}`
}

function formatLocation(venueName: string, venueSuburb: string): string {
  if (venueSuburb?.trim()) return venueSuburb.trim()
  if (venueName?.trim()) return venueName.trim()
  return "Melbourne"
}

function formatVibeLabel(vibe: string): string {
  return vibe
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function CuratedPick() {
  const [event, setEvent] = useState<CuratedEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    async function fetchCuratedPick() {
      const { data, error } = await supabase
        .from("events")
        .select(
          "title,description,start_datetime,end_datetime,venue_name,venue_suburb,image_url,source_url,category,vibes"
        )
        .eq("is_curated_pick", true)
        .eq("status", "approved")
        .order("start_datetime", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error || !data) {
        setEvent(null)
        setLoading(false)
        return
      }

      setEvent({
        title: data.title ?? "",
        description: data.description ?? "",
        start_datetime: data.start_datetime ?? "",
        end_datetime: data.end_datetime ?? "",
        venue_name: data.venue_name ?? "",
        venue_suburb: data.venue_suburb ?? "",
        image_url: data.image_url ?? "",
        source_url: data.source_url ?? "",
        category: data.category ?? "",
        vibes: Array.isArray(data.vibes)
          ? (data.vibes as unknown[]).filter(
              (v): v is string => typeof v === "string" && v.length > 0
            )
          : [],
      })
      setLoading(false)
    }

    fetchCuratedPick()
  }, [])

  if (loading || !event) {
    return null
  }

  const dateRange = formatCuratedDateRange(event.start_datetime, event.end_datetime)
  const location = formatLocation(event.venue_name, event.venue_suburb)
  const programmeHref = event.source_url?.trim() || "#"
  const showImage = event.image_url?.trim() && !imageError

  return (
    <section className="py-12 md:py-16 px-4 md:px-8 lg:px-16 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-primary text-xs uppercase tracking-[0.2em] font-semibold">
            Our Pick This Week
          </span>
          <div className="flex-1 h-px bg-foreground/20" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="relative aspect-[4/3] lg:aspect-square overflow-hidden">
            {showImage ? (
              <img
                src={event.image_url}
                alt={event.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center bg-[#2a2a28] px-4"
                aria-hidden
              >
                <span className="text-center font-[var(--font-display)] text-sm uppercase tracking-[0.2em] text-[#e5e7d4] md:text-base">
                  {event.category || event.title}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center">
            {event.category ? (
              <span className="text-primary text-xs uppercase tracking-[0.15em] font-medium mb-3">
                {event.category}
              </span>
            ) : null}

            <h3 className="font-[var(--font-display)] text-3xl md:text-4xl lg:text-5xl font-black text-foreground uppercase tracking-tight leading-[0.95] mb-6">
              {event.title}
            </h3>

            <p className="text-foreground/80 text-base md:text-lg leading-relaxed mb-6 max-w-xl">
              {event.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground uppercase tracking-wide mb-8">
              {dateRange ? <span>{dateRange}</span> : null}
              {dateRange ? (
                <span className="w-1 h-1 bg-muted-foreground rounded-full" />
              ) : null}
              <span>{location}</span>
              {programmeHref !== "#" ? (
                <>
                  <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                  <a
                    href={programmeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4 hover:opacity-70 transition-opacity normal-case tracking-normal"
                  >
                    Full programme →
                  </a>
                </>
              ) : null}
            </div>

            {event.vibes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {event.vibes.map((vibe) => (
                  <span
                    key={vibe}
                    className="px-3 py-1.5 text-[10px] uppercase tracking-widest border border-foreground/30 text-foreground/70"
                  >
                    {formatVibeLabel(vibe)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
