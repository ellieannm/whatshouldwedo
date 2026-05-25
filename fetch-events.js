#!/usr/bin/env node

/**
 * Fetches upcoming Melbourne events from the Eventbrite API and writes melbourne-events.csv
 *
 * Usage:
 *   node fetch-events.js
 *   MAX_EVENTS=500 node fetch-events.js
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
const MELBOURNE_PLACE_ID = "101933229"
const OUTPUT_FILE = path.join(__dirname, "melbourne-events.csv")
const PAGE_SIZE = Number(process.env.PAGE_SIZE) || 50
const MAX_FETCH = process.env.MAX_EVENTS ? Number(process.env.MAX_EVENTS) : 500
const DETAIL_DELAY_MS = Number(process.env.DETAIL_DELAY_MS) || 100
const MIN_FREE_DURATION_MINUTES = 30

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

const ALLOWED_CATEGORY_MATCHERS = [
  (name) => name === "music" || name.startsWith("music "),
  (name) => name === "arts" || (name.includes("arts") && !name.includes("performing")),
  (name) => name.includes("food") && name.includes("drink"),
  (name) =>
    name.includes("film") &&
    (name.includes("media") || name.includes("entertainment")),
  (name) => name.includes("performing"),
  (name) => name === "nightlife" || name.includes("nightlife"),
  (name) => name === "fashion" || name.includes("fashion"),
  (name) => name.includes("comedy"),
]

const EXCLUDED_KEYWORDS = [
  "tribute",
  "cover band",
  "school",
  "primary",
  "secondary",
  "high school",
  "university",
  "uni",
  "student",
  "campus",
  "o-week",
  "orientation",
  "networking",
  "conference",
  "summit",
  "seminar",
  "workshop",
  "webinar",
  "agm",
  "first aid",
  "cpr",
  "certificate",
  "certification",
  "training",
  "marketing",
  "sales",
  "fighting",
  "mma",
  "boxing",
  "ufc",
  "sports centre",
  "recreation centre",
  "leisure centre",
  "church",
  "mosque",
  "temple",
  "parish",
  "fundraiser",
  "charity gala",
  "kids",
  "children",
  "toddler",
  "baby",
  "junior",
  "support group",
  "therapy",
  "government",
  "council",
]

const FEATURED_VENUES = [
  "Corner Hotel",
  "Howler",
  "The Toff in Town",
  "Collingwood Arts Precinct",
  "The Espy",
  "The Croxton",
  "Brunswick Ballroom",
  "Forum Melbourne",
  "170 Russell",
  "Max Watts",
  "Festival Hall",
  "Northcote Social Club",
  "NGV",
  "ACMI",
  "Arts Centre Melbourne",
  "Hamer Hall",
  "Malthouse Theatre",
  "La Mama Theatre",
  "Theatre Works",
  "The Substation",
  "Meat Market",
  "Abbotsford Convent",
  "Footscray Community Arts",
  "Melbourne Recital Centre",
  "The Night Cat",
  "Bar Open",
  "The Gasometer",
  "Old Bar",
  "The Penny Black",
  "The Grace Darling",
  "The Evelyn Hotel",
  "The Bendigo Hotel",
  "The Thornbury Theatre",
  "Stay Gold",
  "Peel Hotel",
  "Laundry Bar",
  "Revolver Upstairs",
  "New Guernica",
  "Brown Alley",
  "Glamorama",
  "Boney",
  "Section 8",
  "Campari House",
  "Rooftop Bar",
  "1000 Pound Bend",
  "Blindside",
  "West Space",
  "Bus Projects",
  "MARS Gallery",
  "Neon Parc",
  "Anna Schwartz Gallery",
  "Australian Centre for Contemporary Art",
  "Gertrude Contemporary",
]

const FEATURED_ORGANISERS = [
  "Gertrude Events",
  "RISING",
  "Melbourne Fringe",
  "Melbourne International Comedy Festival",
  "NGV Events",
  "ACMI",
  "Collingwood Arts Precinct",
  "Abbotsford Convent",
  "Footscray Community Arts",
  "Testing Grounds",
  "Blindside",
  "Bus Projects",
  "West Space",
  "TCB Art Inc",
  "Margaret Lawrence Gallery",
  "Neon Parc",
  "Anna Schwartz Gallery",
  "Commune",
  "Honey Blood",
  "Rabbit Hole Events",
  "Untitled Group",
  "Sunset Sounds",
  "Secret Sounds",
  "Frontier Touring",
  "Handsome Tours",
]

const CATEGORY_VIBE_MAP = {
  music: "high-energy",
  "food & drink": "groups",
  arts: "low-key",
  "film, media & entertainment": "low-key",
  "performing & visual arts": "low-key",
  nightlife: "late-night",
  fashion: "groups",
  comedy: "groups",
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

  console.log(
    `Searching upcoming events in Melbourne (fetching up to ${MAX_FETCH} IDs)…`
  )

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
      if (ids.length >= MAX_FETCH) {
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
  const expand = "venue,category,ticket_availability,organizer"
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

function parseLocalDatetime(dateTime) {
  const local = dateTime?.local
  if (!local) return null
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  )
}

function getEventDurationMinutes(event) {
  const start = parseLocalDatetime(event.start)
  const end = parseLocalDatetime(event.end)
  if (!start || !end) return null
  return (end.getTime() - start.getTime()) / (1000 * 60)
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

function getEventTitle(event) {
  return event.name?.text || event.name || ""
}

function getEventDescription(event) {
  return (
    stripHtml(event.description?.text) ||
    stripHtml(event.description?.html) ||
    event.summary ||
    ""
  )
}

function getEventCategory(event) {
  return event.category?.name || event.category?.short_name || ""
}

function normalizeCategoryName(categoryName) {
  return (categoryName || "").toLowerCase().trim()
}

function isAllowedCategory(categoryName) {
  const normalized = normalizeCategoryName(categoryName)
  if (!normalized) return false
  return ALLOWED_CATEGORY_MATCHERS.some((matcher) => matcher(normalized))
}

function normalizeText(text) {
  return (text || "").toLowerCase()
}

function hasExcludedKeyword(title, description) {
  const haystack = normalizeText(`${title} ${description}`)
  return EXCLUDED_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

function normalizeVenueName(venueName) {
  return (venueName || "").toLowerCase().trim()
}

function isWhitelistedVenue(venueName) {
  const normalized = normalizeVenueName(venueName)
  if (!normalized) return false
  return FEATURED_VENUES.some((venue) => {
    const venueLower = venue.toLowerCase()
    return normalized.includes(venueLower) || venueLower.includes(normalized)
  })
}

function getOrganizerName(event) {
  return event.organizer?.name || ""
}

function isWhitelistedOrganiser(organiserName) {
  const normalized = (organiserName || "").toLowerCase().trim()
  if (!normalized) return false
  return FEATURED_ORGANISERS.some((organiser) => {
    const organiserLower = organiser.toLowerCase()
    return (
      normalized.includes(organiserLower) || organiserLower.includes(normalized)
    )
  })
}

function bypassesKeywordFilter(event) {
  return (
    isWhitelistedVenue(event.venue?.name || "") ||
    isWhitelistedOrganiser(getOrganizerName(event))
  )
}

function isFeaturedEvent(event) {
  return bypassesKeywordFilter(event)
}

function isOnlineOnlyEvent(event) {
  return event.online_event === true || event.is_online_event === true
}

/**
 * Eventbrite often returns img.evbuc.com proxy URLs with the real CDN URL
 * URL-encoded in the path, e.g. img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2F...
 */
function cleanImageUrl(rawUrl) {
  if (!rawUrl?.trim()) return ""

  const url = rawUrl.trim()

  try {
    const parsed = new URL(url)

    if (
      parsed.hostname === "img.evbuc.com" ||
      parsed.hostname.endsWith(".evbuc.com")
    ) {
      const encodedPath = parsed.pathname.slice(1)
      if (encodedPath) {
        const decoded = decodeURIComponent(encodedPath)
        if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
          return decoded
        }
      }
    }

    return url
  } catch {
    const proxyMatch = url.match(/img\.evbuc\.com\/(https?%3A%2F%2F.+)/i)
    if (proxyMatch) {
      try {
        return decodeURIComponent(proxyMatch[1].split("?")[0])
      } catch {
        return url
      }
    }
    return url
  }
}

function getEventImageUrl(event) {
  const raw = event.logo?.original?.url || event.logo?.url || ""
  return cleanImageUrl(raw)
}

function hasEventImage(event) {
  return Boolean(getEventImageUrl(event))
}

function isShortFreeEvent(event) {
  if (!event.is_free) return false
  const durationMinutes = getEventDurationMinutes(event)
  if (durationMinutes === null) return false
  return durationMinutes < MIN_FREE_DURATION_MINUTES
}

function getExclusionReason(event) {
  const title = getEventTitle(event)
  const description = getEventDescription(event)
  const category = getEventCategory(event)

  if (!isAllowedCategory(category)) {
    return `category not allowed: ${category || "(none)"}`
  }
  if (!hasEventImage(event)) {
    return "no image"
  }
  if (isOnlineOnlyEvent(event)) {
    return "online-only event"
  }
  if (isShortFreeEvent(event)) {
    return "free event under 30 minutes"
  }
  if (!bypassesKeywordFilter(event) && hasExcludedKeyword(title, description)) {
    return "excluded keyword in title or description"
  }

  return null
}

function inferVibe(event) {
  if (event.is_free) return "free-cheap"

  const categoryName = normalizeCategoryName(
    event.category?.short_name || event.category?.name || ""
  )

  if (CATEGORY_VIBE_MAP[categoryName]) {
    return CATEGORY_VIBE_MAP[categoryName]
  }

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

function mapEventToRow(event, { isFeatured = false } = {}) {
  const description = getEventDescription(event)
  const venue = event.venue
  const venueSuburb =
    venue?.address?.city ||
    venue?.address?.localized_area_display?.split(",")?.[0]?.trim() ||
    ""

  return {
    title: getEventTitle(event),
    description,
    start_datetime: formatDatetime(event.start),
    end_datetime: formatDatetime(event.end),
    venue_name: venue?.name || "",
    venue_suburb: venueSuburb,
    category: getEventCategory(event),
    vibe: inferVibe(event),
    price_range: getPriceRange(event),
    image_url: getEventImageUrl(event),
    source_url: event.url || "",
    is_featured: isFeatured ? "true" : "false",
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
  const eventIds = await searchEventIds()

  if (eventIds.length === 0) {
    console.log("No events found.")
    fs.writeFileSync(OUTPUT_FILE, rowsToCsv([]))
    return
  }

  console.log(`Fetching details for ${eventIds.length} events…`)

  const rows = []
  let excludedCount = 0
  let featuredCount = 0

  for (let i = 0; i < eventIds.length; i++) {
    const eventId = eventIds[i]
    try {
      const event = await fetchEventDetails(eventId)
      const exclusionReason = getExclusionReason(event)
      if (exclusionReason) {
        excludedCount++
        console.log(
          `  [${i + 1}/${eventIds.length}] skipped: ${getEventTitle(event)} (${exclusionReason})`
        )
        continue
      }

      const isFeatured = isFeaturedEvent(event)
      if (isFeatured) featuredCount++

      rows.push(mapEventToRow(event, { isFeatured }))
      const featuredTag = isFeatured ? " [featured]" : ""
      console.log(
        `  [${i + 1}/${eventIds.length}] ${rows[rows.length - 1].title}${featuredTag}`
      )
    } catch (error) {
      console.warn(`  Skipping event ${eventId}: ${error.message}`)
    }

    if (DETAIL_DELAY_MS > 0 && i < eventIds.length - 1) {
      await sleep(DETAIL_DELAY_MS)
    }
  }

  fs.writeFileSync(OUTPUT_FILE, rowsToCsv(rows))
  console.log(
    `\nWrote ${rows.length} events to ${OUTPUT_FILE} (${excludedCount} filtered out, ${featuredCount} featured)`
  )
}

main().catch((error) => {
  console.error("Error:", error.message)
  process.exit(1)
})
