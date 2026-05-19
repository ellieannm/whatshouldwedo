#!/usr/bin/env node

/**
 * Fetches upcoming Melbourne events from the Eventbrite API and writes melbourne-events.csv
 *
 * Usage:
 *   EVENTBRITE_API_KEY=your_key node fetch-events.js
 *   MAX_EVENTS=50 node fetch-events.js
 *
 * Set EVENTBRITE_API_KEY in .env.local or your shell environment.
 */

const fs = require("fs")
const path = require("path")

function loadEnvLocal() {
  const envPath = path.join(__dirname, ".env.local")
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

const API_KEY = process.env.EVENTBRITE_API_KEY
if (!API_KEY) {
  console.error(
    "Missing EVENTBRITE_API_KEY. Add it to .env.local or pass it when running the script."
  )
  process.exit(1)
}
const API_BASE = "https://www.eventbriteapi.com/v3"
const MELBOURNE_PLACE_ID = "101933229" // Melbourne, Australia (from Eventbrite destination pages)
const OUTPUT_FILE = path.join(__dirname, "melbourne-events.csv")
const PAGE_SIZE = Number(process.env.PAGE_SIZE) || 50
const MAX_EVENTS = process.env.MAX_EVENTS ? Number(process.env.MAX_EVENTS) : null
const DETAIL_DELAY_MS = Number(process.env.DETAIL_DELAY_MS) || 100

const CSV_HEADERS = [
  "title",
  "description",
  "start_datetime",
  "end_datetime",
  "venue_name",
  "venue_suburb",
  "category",
  "vibe",
  "price_range",
  "image_url",
  "source_url",
  "is_featured",
  "is_curated_pick",
]

const CATEGORY_VIBE_MAP = {
  music: "high-energy",
  "food & drink": "groups",
  health: "low-key",
  "sports & fitness": "high-energy",
  arts: "low-key",
  "film, media & entertainment": "low-key",
  nightlife: "late-night",
  business: "groups",
  charity: "groups",
  community: "groups",
  family: "groups",
  fashion: "groups",
  "home & lifestyle": "low-key",
  "hobbies & special interest": "low-key",
  "performing & visual arts": "low-key",
  science: "low-key",
  travel: "groups",
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`)
  }

  if (!response.ok) {
    throw new Error(
      data.error_description || data.error || `HTTP ${response.status} for ${url}`
    )
  }

  return data
}

async function searchEventIds() {
  const ids = []
  let continuation = null

  console.log("Searching upcoming events in Melbourne, Australia…")

  while (true) {
    const eventSearch = {
      dates: "current_future",
      places: [MELBOURNE_PLACE_ID],
      page_size: PAGE_SIZE,
    }

    if (continuation) {
      eventSearch.continuation = continuation
    }

    const data = await apiRequest(`${API_BASE}/destination/search/`, {
      method: "POST",
      body: JSON.stringify({ event_search: eventSearch }),
    })

    const results = data.events?.results ?? []
    for (const result of results) {
      const id = result.eventbrite_event_id || result.id
      if (id && !ids.includes(String(id))) {
        ids.push(String(id))
      }
      if (MAX_EVENTS && ids.length >= MAX_EVENTS) {
        return ids
      }
    }

    continuation = data.events?.pagination?.continuation
    const total = data.events?.pagination?.object_count ?? ids.length
    console.log(`  Found ${ids.length} / ${total} event IDs…`)

    if (!continuation || results.length === 0) {
      break
    }
  }

  return ids
}

async function fetchEventDetails(eventId) {
  const expand = "venue,category,ticket_availability"
  return apiRequest(`${API_BASE}/events/${eventId}/?expand=${expand}`)
}

function formatDatetime(dateTime) {
  const local = dateTime?.local
  if (!local) return ""
  const match = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/)
  if (match) {
    return `${match[1]} ${match[2]}`
  }
  return local.replace("T", " ").replace(/Z$/, "")
}

function stripHtml(html) {
  if (!html) return ""
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function inferVibe(event) {
  if (event.is_free) return "free-cheap"

  const categoryName = (
    event.category?.short_name ||
    event.category?.name ||
    ""
  ).toLowerCase()

  if (CATEGORY_VIBE_MAP[categoryName]) {
    return CATEGORY_VIBE_MAP[categoryName]
  }

  const formatTag = (event.format_id || "").toString()
  if (formatTag === "6") return "high-energy"

  return ""
}

function getPriceRange(event) {
  if (event.is_free) return "Free"

  const min = event.ticket_availability?.minimum_ticket_price
  const max = event.ticket_availability?.maximum_ticket_price

  if (min?.display && max?.display && min.display !== max.display) {
    return `${min.display} - ${max.display}`
  }
  if (min?.display) return min.display
  if (max?.display) return max.display

  return "Paid"
}

function mapEventToRow(event) {
  const description =
    stripHtml(event.description?.text) ||
    stripHtml(event.description?.html) ||
    event.summary ||
    ""

  const venue = event.venue
  const venueSuburb =
    venue?.address?.city ||
    venue?.address?.localized_area_display?.split(",")?.[0]?.trim() ||
    ""

  return {
    title: event.name?.text || event.name || "",
    description,
    start_datetime: formatDatetime(event.start),
    end_datetime: formatDatetime(event.end),
    venue_name: venue?.name || "",
    venue_suburb: venueSuburb,
    category: event.category?.name || event.category?.short_name || "",
    vibe: inferVibe(event),
    price_range: getPriceRange(event),
    image_url: event.logo?.original?.url || event.logo?.url || "",
    source_url: event.url || "",
    is_featured: "false",
    is_curated_pick: "false",
  }
}

function csvEscape(value) {
  const str = value == null ? "" : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowsToCsv(rows) {
  const lines = [CSV_HEADERS.join(",")]
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((header) => csvEscape(row[header])).join(","))
  }
  return lines.join("\n") + "\n"
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  // Public /events/search/ was retired; destination search is the supported discovery API.
  const eventIds = await searchEventIds()

  if (eventIds.length === 0) {
    console.log("No events found.")
    fs.writeFileSync(OUTPUT_FILE, rowsToCsv([]))
    return
  }

  console.log(`Fetching details for ${eventIds.length} events…`)

  const rows = []
  for (let i = 0; i < eventIds.length; i++) {
    const eventId = eventIds[i]
    try {
      const event = await fetchEventDetails(eventId)
      rows.push(mapEventToRow(event))
      console.log(`  [${i + 1}/${eventIds.length}] ${rows[rows.length - 1].title}`)
    } catch (error) {
      console.warn(`  Skipping event ${eventId}: ${error.message}`)
    }

    if (DETAIL_DELAY_MS > 0 && i < eventIds.length - 1) {
      await sleep(DETAIL_DELAY_MS)
    }
  }

  fs.writeFileSync(OUTPUT_FILE, rowsToCsv(rows))
  console.log(`\nWrote ${rows.length} events to ${OUTPUT_FILE}`)
}

main().catch((error) => {
  console.error("Error:", error.message)
  process.exit(1)
})
