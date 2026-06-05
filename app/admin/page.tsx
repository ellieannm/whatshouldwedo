"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

const ADMIN_PASSWORD = "wswd2026"
const ADMIN_AUTH_KEY = "wswd-admin-authenticated"

type EventStatus = "approved" | "rejected" | "pending"
type FilterStatus = "all" | EventStatus
type AdminTab = "events" | "parse"

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

type ParsedEvent = {
  title: string
  description: string
  start_datetime: string
  end_datetime: string
  venue_name: string
  venue_suburb: string
  source_url: string
  image_url: string
  category: string
  vibes: string[]
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
  "date-night",
] as const

const availableCategories = [
  "Music",
  "Arts",
  "Food & Drink",
  "Film & Media",
  "Performing Arts",
  "Nightlife",
  "Fashion",
  "Comedy",
  "Community Submission",
]

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
  const [activeTab, setActiveTab] = useState<AdminTab>("events")

  // Events tab state
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all")
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null)
  const [editingVibesEventId, setEditingVibesEventId] = useState<string | null>(null)
  const [updatingVibesEventId, setUpdatingVibesEventId] = useState<string | null>(null)
  const [updatingCuratedPickEventId, setUpdatingCuratedPickEventId] = useState<string | null>(null)

  // Parse tab state
  const [parseText, setParseText] = useState("")
  const [parseImageFile, setParseImageFile] = useState<File | null>(null)
  const [parseImagePreview, setParseImagePreview] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedEvent, setParsedEvent] = useState<ParsedEvent | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_AUTH_KEY)
    setIsAuthed(stored === "true")
  }, [])

  useEffect(() => {
    if (!isAuthed) {
      setLoading(false)
      return
    }
    fetchEvents()
  }, [isAuthed])

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
    if (!response.ok) {
      setEvents(previousEvents)
      setError(payload.error || "Could not update status")
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
      current.map((event) => ({ ...event, is_curated_pick: event.id === eventId }))
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setParseImageFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setParseImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setParseImagePreview(null)
    }
  }

  const handleParse = async () => {
    if (!parseText.trim() && !parseImageFile) {
      setParseError("Paste some text or upload an image first.")
      return
    }
    setParsing(true)
    setParseError(null)
    setParsedEvent(null)
    setSaveSuccess(false)

    let imageBase64: string | undefined
    let imageMediaType: string | undefined

    if (parseImageFile) {
      const reader = new FileReader()
      imageBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result.split(",")[1])
        }
        reader.readAsDataURL(parseImageFile)
      })
      imageMediaType = parseImageFile.type
    }

    const response = await fetch("/api/parse-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: parseText.trim() || undefined,
        imageBase64,
        imageMediaType,
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as {
      event?: ParsedEvent
      error?: string
    }

    if (!response.ok || !payload.event) {
      setParseError(payload.error || "Parse failed")
      setParsing(false)
      return
    }

    setParsedEvent(payload.event)
    setParsing(false)
  }

  const handleSaveParsed = async () => {
    if (!parsedEvent) return
    setSaving(true)
    setParseError(null)

    const response = await fetch("/api/parse-event", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedEvent),
    })

    const payload = (await response.json().catch(() => ({}))) as { error?: string }

    if (!response.ok) {
      setParseError(payload.error || "Save failed")
      setSaving(false)
      return
    }

    setSaveSuccess(true)
    setSaving(false)
    setParsedEvent(null)
    setParseText("")
    setParseImageFile(null)
    setParseImagePreview(null)
  }

  const toggleParsedVibe = (vibe: string) => {
    if (!parsedEvent) return
    const next = parsedEvent.vibes.includes(vibe)
      ? parsedEvent.vibes.filter((v) => v !== vibe)
      : [...parsedEvent.vibes, vibe]
    setParsedEvent({ ...parsedEvent, vibes: next })
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
        {/* Header */}
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

        {/* Top-level tabs */}
        <div className="mb-8 flex gap-2 border-b border-foreground/20 pb-0">
          {(["events", "parse"] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "events" ? "Events" : "Parse Event"}
            </button>
          ))}
        </div>

        {/* ── PARSE TAB ── */}
        {activeTab === "parse" && (
          <div className="max-w-2xl">
            <p className="mb-6 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Paste a caption, article text, or URL — or upload an Instagram flyer. AI will extract
              the event details for you to review before saving.
            </p>

            <div className="mb-4">
              <label className="mb-2 block text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Paste text / URL
              </label>
              <textarea
                value={parseText}
                onChange={(e) => setParseText(e.target.value)}
                rows={6}
                placeholder="Paste Instagram caption, Substack excerpt, event URL, or any text about the event…"
                className="w-full border border-foreground bg-transparent px-3 py-2 text-sm tracking-wide outline-none focus:border-primary placeholder:text-muted-foreground resize-none"
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Upload flyer image (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="text-xs uppercase tracking-wide text-foreground file:mr-4 file:border file:border-foreground file:bg-transparent file:px-3 file:py-1 file:text-[10px] file:font-semibold file:uppercase file:tracking-[0.15em] file:text-foreground hover:file:bg-foreground hover:file:text-background"
              />
              {parseImagePreview && (
                <img
                  src={parseImagePreview}
                  alt="Preview"
                  className="mt-3 max-h-48 object-contain border border-foreground/40"
                />
              )}
            </div>

            <button
              type="button"
              onClick={handleParse}
              disabled={parsing}
              className="mb-6 border border-primary bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-60"
            >
              {parsing ? "Parsing…" : "Parse Event"}
            </button>

            {parseError && (
              <p className="mb-4 border border-primary p-3 text-xs uppercase tracking-[0.12em] text-primary">
                {parseError}
              </p>
            )}

            {saveSuccess && (
              <p className="mb-4 border border-[#2e7d32] p-3 text-xs uppercase tracking-[0.12em] text-[#2e7d32]">
                Saved to pending — check the Events tab to review.
              </p>
            )}

            {parsedEvent && (
              <div className="border border-foreground p-6 space-y-4">
                <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-4">
                  Review + edit before saving
                </p>

                {[
                  { label: "Title", key: "title" },
                  { label: "Venue", key: "venue_name" },
                  { label: "Suburb", key: "venue_suburb" },
                  { label: "Source URL", key: "source_url" },
                  { label: "Image URL", key: "image_url" },
                  { label: "Start (ISO)", key: "start_datetime" },
                  { label: "End (ISO)", key: "end_datetime" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={(parsedEvent as Record<string, unknown>)[key] as string ?? ""}
                      onChange={(e) =>
                        setParsedEvent({ ...parsedEvent, [key]: e.target.value })
                      }
                      className="w-full border border-foreground/60 bg-transparent px-3 py-2 text-sm tracking-wide outline-none focus:border-primary"
                    />
                  </div>
                ))}

                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    value={parsedEvent.description}
                    onChange={(e) =>
                      setParsedEvent({ ...parsedEvent, description: e.target.value })
                    }
                    className="w-full border border-foreground/60 bg-transparent px-3 py-2 text-sm tracking-wide outline-none focus:border-primary resize-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Category
                  </label>
                  <select
                    value={parsedEvent.category}
                    onChange={(e) =>
                      setParsedEvent({ ...parsedEvent, category: e.target.value })
                    }
                    className="w-full border border-foreground/60 bg-background px-3 py-2 text-sm tracking-wide outline-none focus:border-primary"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Vibes
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableVibes.map((vibe) => (
                      <button
                        key={vibe}
                        type="button"
                        onClick={() => toggleParsedVibe(vibe)}
                        className={`px-3 py-1 text-[10px] uppercase tracking-wide border transition-colors ${
                          parsedEvent.vibes.includes(vibe)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-foreground/60 text-foreground hover:border-foreground"
                        }`}
                      >
                        {vibe}
                      </button>
                    ))}
                  </div>
                </div>

                {parsedEvent.image_url && (
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      Image preview
                    </label>
                    <img
                      src={parsedEvent.image_url}
                      alt="Event"
                      className="max-h-40 object-contain border border-foreground/40"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveParsed}
                  disabled={saving}
                  className="w-full border border-[#2e7d32] bg-[#2e7d32] px-6 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save to Pending"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── EVENTS TAB ── */}
        {activeTab === "events" && (
          <>
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
                      <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">Image</th>
                      <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">Title</th>
                      <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">Start</th>
                      <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">Venue</th>
                      <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">Source</th>
                      <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">Vibes</th>
                      <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">Status</th>
                      <th className="px-3 py-3 text-left text-[11px] uppercase tracking-[0.15em]">Actions</th>
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
          </>
        )}
      </div>
    </main>
  )
}