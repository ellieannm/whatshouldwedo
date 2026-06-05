"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

const ADMIN_PASSWORD = "wswd2026"
const ADMIN_AUTH_KEY = "wswd-admin-authenticated"

type EventStatus = "approved" | "rejected" | "pending"
type FilterStatus = "all" | EventStatus

type AdminEvent = {
  id: string
  title: string
  start_datetime: string
  venue_name: string
  venue_suburb: string
  image_url: string
  source_name: string | null
  source_url: string
  vibes: string[]
  status: string | null
  is_curated_pick: boolean
}

const statusFilters: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
]

const availableVibes = [
  "late-night",
  "low-key",
  "high-energy",
  "free-cheap",
  "solo-friendly",
  "groups",
] as const

function toDisplayStatus(status: string | null): EventStatus {
  if (status === "approved" || status === "rejected") return status
  return "pending"
}

function inferSourceName(sourceName: string | null, sourceUrl: string): string {
  if (sourceName?.trim()) return sourceName.trim()
  if (sourceUrl.toLowerCase().includes("urbanlist")) return "Urban List"
  return "Eventbrite"
}

function formatStartDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || "Unknown date"
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export default function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all")
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null)
  const [editingVibesEventId, setEditingVibesEventId] = useState<string | null>(null)
  const [updatingVibesEventId, setUpdatingVibesEventId] = useState<string | null>(null)
  const [updatingCuratedPickEventId, setUpdatingCuratedPickEventId] = useState<string | null>(
    null
  )

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_AUTH_KEY)
    setIsAuthed(stored === "true")
  }, [])

  useEffect(() => {
    if (!isAuthed) {
      setLoading(false)
      return
    }

    async function fetchEvents() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("events")
        .select(
          "id,title,start_datetime,venue_name,venue_suburb,image_url,source_name,source_url,vibes,status,is_curated_pick"
        )
        .order("start_datetime", { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setEvents(
        (data ?? []).map((row) => ({
          id: String(row.id),
          title: row.title ?? "",
          start_datetime: row.start_datetime ?? "",
          venue_name: row.venue_name ?? "",
          venue_suburb: row.venue_suburb ?? "",
          image_url: row.image_url ?? "",
          source_name: row.source_name ?? null,
          source_url: row.source_url ?? "",
          vibes: Array.isArray(row.vibes)
            ? (row.vibes as unknown[]).filter(
                (v): v is string => typeof v === "string" && v.length > 0
              )
            : [],
          status: row.status ?? null,
          is_curated_pick: row.is_curated_pick === true,
        }))
      )
      setLoading(false)
    }

    fetchEvents()
  }, [isAuthed])

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return events
    return events.filter((event) => toDisplayStatus(event.status) === activeFilter)
  }, [activeFilter, events])

  const onSubmitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password === ADMIN_PASSWORD) {
      window.localStorage.setItem(ADMIN_AUTH_KEY, "true")
      setIsAuthed(true)
      setPassword("")
      setPasswordError("")
      return
    }
    setPasswordError("Incorrect password")
  }

  const onLogout = () => {
    window.localStorage.removeItem(ADMIN_AUTH_KEY)
    setIsAuthed(false)
  }

  const updateEventStatus = async (eventId: string, status: "approved" | "rejected") => {
    setUpdatingEventId(eventId)
    setError(null)

    const previousEvents = events
    setEvents((current) =>
      current.map((event) => (event.id === eventId ? { ...event, status } : event))
    )

    const response = await fetch("/api/admin/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, status }),
    })

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      status?: string
    }

    console.log("[admin] update-status response", {
      eventId,
      status,
      ok: response.ok,
      statusCode: response.status,
      payload,
    })

    if (!response.ok) {
      setEvents(previousEvents)
      setError(payload.error || "Could not update status")
      console.error("[admin] update-status failed", payload.error || response.statusText)
    } else {
      console.log("[admin] update-status succeeded", payload)
    }

    setUpdatingEventId(null)
  }

  const updateEventVibes = async (eventId: string, vibe: (typeof availableVibes)[number]) => {
    setUpdatingVibesEventId(eventId)
    setError(null)

    const previousEvents = events
    const targetEvent = events.find((event) => event.id === eventId)
    if (!targetEvent) {
      setUpdatingVibesEventId(null)
      return
    }

    const nextVibes = targetEvent.vibes.includes(vibe)
      ? targetEvent.vibes.filter((item) => item !== vibe)
      : [...targetEvent.vibes, vibe]

    setEvents((current) =>
      current.map((event) => (event.id === eventId ? { ...event, vibes: nextVibes } : event))
    )

    const { error: updateError } = await supabase
      .from("events")
      .update({ vibes: nextVibes })
      .eq("id", eventId)

    if (updateError) {
      setEvents(previousEvents)
      setError(updateError.message)
    }

    setUpdatingVibesEventId(null)
  }

  const setCuratedPick = async (eventId: string) => {
    setUpdatingCuratedPickEventId(eventId)
    setError(null)

    const previousEvents = events
    setEvents((current) =>
      current.map((event) => ({
        ...event,
        is_curated_pick: event.id === eventId,
      }))
    )

    const { error: clearError } = await supabase
      .from("events")
      .update({ is_curated_pick: false })
      .eq("is_curated_pick", true)

    if (clearError) {
      setEvents(previousEvents)
      setError(clearError.message)
      setUpdatingCuratedPickEventId(null)
      return
    }

    const { error: pickError } = await supabase
      .from("events")
      .update({ is_curated_pick: true })
      .eq("id", eventId)

    if (pickError) {
      setEvents(previousEvents)
      setError(pickError.message)
    }

    setUpdatingCuratedPickEventId(null)
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-background px-4">
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center">
          <form onSubmit={onSubmitPassword} className="w-full border border-foreground p-8">
            <h1 className="mb-2 font-[var(--font-display)] text-4xl uppercase tracking-tight">
              Admin
            </h1>
            <p className="mb-6 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Enter password
            </p>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-3 w-full border border-foreground bg-transparent px-3 py-2 text-sm uppercase tracking-wider outline-none focus:border-primary"
              autoFocus
              required
            />
            {passwordError ? (
              <p className="mb-3 text-xs uppercase tracking-wide text-primary">{passwordError}</p>
            ) : null}
            <button
              type="submit"
              className="w-full border border-primary bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground"
            >
              Unlock
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-[var(--font-display)] text-4xl uppercase tracking-tight md:text-5xl">
              Event Admin
            </h1>
            <p className="mt-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Moderate WSWD events
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-fit border border-foreground px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] hover:bg-foreground hover:text-background"
          >
            Log out
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`border px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] ${
                activeFilter === filter.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-foreground text-foreground hover:bg-foreground hover:text-background"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mb-4 border border-primary p-3 text-xs uppercase tracking-[0.12em] text-primary">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="py-12 text-center text-sm uppercase tracking-[0.15em] text-muted-foreground">
            Loading events...
          </p>
        ) : (
          <div className="overflow-x-auto border border-foreground">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-foreground">
                  <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">
                    Image
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">
                    Title
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">
                    Start
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">
                    Venue
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">
                    Source
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">
                    Vibes
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => {
                  const displayStatus = toDisplayStatus(event.status)
                  const isUpdating = updatingEventId === event.id
                  const isEditingVibes = editingVibesEventId === event.id
                  const isUpdatingVibes = updatingVibesEventId === event.id
                  const isUpdatingCuratedPick = updatingCuratedPickEventId === event.id
                  const isCuratedPick = event.is_curated_pick

                  return (
                    <tr
                      key={event.id}
                      className={`border-b border-foreground/40 align-top ${
                        isCuratedPick ? "bg-[#d4a017]/10" : ""
                      }`}
                    >
                      <td className="px-3 py-3">
                        {event.image_url ? (
                          <img
                            src={event.image_url}
                            alt={event.title}
                            width={60}
                            height={60}
                            className="h-[60px] w-[60px] object-cover"
                          />
                        ) : (
                          <div className="flex h-[60px] w-[60px] items-center justify-center border border-foreground text-[10px] uppercase tracking-wide text-muted-foreground">
                            No image
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium uppercase tracking-wide">
                        <div>{event.title}</div>
                        {isCuratedPick ? (
                          <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#b8860b]">
                            ★ Curated Pick
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                        {formatStartDate(event.start_datetime)}
                      </td>
                      <td className="px-3 py-3 text-xs uppercase tracking-wide">
                        <div>{event.venue_name || "-"}</div>
                        <div className="text-muted-foreground">{event.venue_suburb || "-"}</div>
                      </td>
                      <td className="px-3 py-3 text-xs uppercase tracking-wide">
                        {inferSourceName(event.source_name, event.source_url)}
                      </td>
                      <td className="px-3 py-3">
                        {isEditingVibes ? (
                          <div className="space-y-1">
                            {availableVibes.map((vibe) => (
                              <label
                                key={`${event.id}-${vibe}-edit`}
                                className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em]"
                              >
                                <input
                                  type="checkbox"
                                  checked={event.vibes.includes(vibe)}
                                  onChange={() => updateEventVibes(event.id, vibe)}
                                  disabled={isUpdatingVibes}
                                  className="h-3 w-3 border border-foreground accent-primary"
                                />
                                <span>{vibe}</span>
                              </label>
                            ))}
                            <button
                              type="button"
                              onClick={() => setEditingVibesEventId(null)}
                              className="pt-1 text-[10px] uppercase tracking-[0.15em] text-primary"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingVibesEventId(event.id)}
                            className="w-full text-left"
                          >
                            <div className="flex flex-wrap gap-1">
                              {event.vibes.length > 0 ? (
                                event.vibes.map((vibe) => (
                                  <span
                                    key={`${event.id}-${vibe}`}
                                    className="border border-foreground px-2 py-1 text-[10px] uppercase tracking-wide"
                                  >
                                    {vibe}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                  -
                                </span>
                              )}
                            </div>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs uppercase tracking-[0.12em]">
                        {displayStatus}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => updateEventStatus(event.id, "approved")}
                              disabled={isUpdating}
                              className="border border-[#2e7d32] bg-[#2e7d32] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => updateEventStatus(event.id, "rejected")}
                              disabled={isUpdating}
                              className="border border-primary bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCuratedPick(event.id)}
                            disabled={isCuratedPick || isUpdatingCuratedPick}
                            className="w-fit border border-[#b8860b] bg-[#d4a017] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#1a1a1a] disabled:opacity-60"
                          >
                            {isCuratedPick ? "Curated Pick" : "Set as Curated Pick"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
