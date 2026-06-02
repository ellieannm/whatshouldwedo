#!/usr/bin/env node

/**
 * Fetches upcoming Melbourne events from the Eventbrite API and inserts them into Supabase.
 *
 * Usage:
 *   node fetch-events.js
 *   MAX_EVENTS=1000 node fetch-events.js
 *
 * Set EVENTBRITE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * in .env.local or your shell environment.
 */

const fs = require("fs")
const path = require("path")
const { createSupabaseClient } = require("./lib/supabase-client.js")

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

let supabase
try {
  supabase = createSupabaseClient()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const API_KEY = process.env.EVENTBRITE_API_KEY
if (!API_KEY) {
  console.error(
    "Missing EVENTBRITE_API_KEY. Add it to .env.local or pass it when running the script."
  )
  process.exit(1)
}

const API_BASE = "https://www.eventbriteapi.com/v3"
const MELBOURNE_PLACE_ID = "101933229"
const PAGE_SIZE = Number(process.env.PAGE_SIZE) || 50
const MAX_FETCH = process.env.MAX_EVENTS ? Number(process.env.MAX_EVENTS) : 1000
const DETAIL_DELAY_MS = Number(process.env.DETAIL_DELAY_MS) || 100
const MIN_FREE_DURATION_MINUTES = 30
const MAX_EVENT_DAYS_AHEAD = 30
const MELBOURNE_TZ = "Australia/Melbourne"

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
  "2000s",
  "80s",
  "90s",
  "decades of dance",
  "decade",
  "nostalgia",
  "end of semester",
  "wholefoods",
  "throwback",
  "classic hits",
  "greatest hits",
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
  "underage",
  "violence",
  "exam",
  "marketing",
  "sales",
  "finance",
  "financial",
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
  "zion",
  "israel",
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
  "afro",
  "bollywood",
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

function formatDateKeyInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return formatDateKeyInTimeZone(date, MELBOURNE_TZ)
}

function getEventStartDateKey(event) {
  const local = event.start?.local
  if (!local) return null
  const match = local.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function getDateWindowKeys() {
  const todayKey = formatDateKeyInTimeZone(new Date(), MELBOURNE_TZ)
  const maxKey = addDaysToDateKey(todayKey, MAX_EVENT_DAYS_AHEAD)
  return { todayKey, maxKey }
}

function isWithinDateWindow(event) {
  const startKey = getEventStartDateKey(event)
  if (!startKey) return false
  const { todayKey, maxKey } = getDateWindowKeys()
  return startKey >= todayKey && startKey <= maxKey
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
  if (!isWithinDateWindow(event)) {
    const startKey = getEventStartDateKey(event)
    const { todayKey, maxKey } = getDateWindowKeys()
    return `outside date window (${startKey || "unknown"}; allowed ${todayKey}–${maxKey})`
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

function mapEventToDbRecord(event, { isFeatured = false } = {}) {
  const description = getEventDescription(event)
  const venue = event.venue
  const venueSuburb =
    venue?.address?.city ||
    venue?.address?.localized_area_display?.split(",")?.[0]?.trim() ||
    ""
  const vibe = inferVibe(event)
  const startDatetime = formatDatetime(event.start)

  return {
    title: getEventTitle(event),
    description,
    start_datetime: startDatetime,
    end_datetime: formatDatetime(event.end),
    venue_name: venue?.name || "",
    venue_suburb: venueSuburb,
    category: getEventCategory(event),
    vibes: vibe ? [vibe] : [],
    price_range: getPriceRange(event),
    image_url: getEventImageUrl(event),
    source_url: event.url || "",
    is_featured: isFeatured,
    is_curated_pick: false,
  }
}

async function sourceUrlExists(sourceUrl) {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("source_url", sourceUrl)
    .limit(1)

  if (error) {
    throw new Error(`Duplicate check failed: ${error.message}`)
  }

  return (data?.length ?? 0) > 0
}

async function insertEvent(record) {
  const { error } = await supabase.from("events").insert(record)

  if (error) {
    throw new Error(error.message)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const { todayKey, maxKey } = getDateWindowKeys()
  console.log(
    `Date filter: start dates from ${todayKey} through ${maxKey} (Melbourne)`
  )

  const eventIds = await searchEventIds()

  if (eventIds.length === 0) {
    console.log("No events found.")
    return
  }

  console.log(`Fetching details for ${eventIds.length} events…`)

  let excludedCount = 0
  let duplicateCount = 0
  let insertedCount = 0
  let featuredCount = 0
  let errorCount = 0

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

      const record = mapEventToDbRecord(event, {
        isFeatured: isFeaturedEvent(event),
      })

      if (!record.source_url) {
        excludedCount++
        console.log(
          `  [${i + 1}/${eventIds.length}] skipped: ${record.title} (no source_url)`
        )
        continue
      }

      if (await sourceUrlExists(record.source_url)) {
        duplicateCount++
        console.log(
          `  [${i + 1}/${eventIds.length}] duplicate: ${record.title}`
        )
        continue
      }

      await insertEvent(record)
      insertedCount++
      if (record.is_featured) featuredCount++

      const featuredTag = record.is_featured ? " [featured]" : ""
      console.log(
        `  [${i + 1}/${eventIds.length}] inserted: ${record.title}${featuredTag}`
      )
    } catch (error) {
      errorCount++
      console.warn(`  Skipping event ${eventId}: ${error.message}`)
    }

    if (DETAIL_DELAY_MS > 0 && i < eventIds.length - 1) {
      await sleep(DETAIL_DELAY_MS)
    }
  }

  console.log(
    `\nDone: ${insertedCount} inserted, ${duplicateCount} duplicates skipped, ${excludedCount} filtered out, ${errorCount} errors (${featuredCount} featured)`
  )
}

main().catch((error) => {
  console.error("Error:", error.message)
  process.exit(1)
})
