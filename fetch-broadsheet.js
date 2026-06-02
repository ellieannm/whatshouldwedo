#!/usr/bin/env node

/**
 * Scrapes Melbourne events from Broadsheet and inserts them into Supabase.
 *
 * Usage:
 *   node fetch-broadsheet.js
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local or .env.
 * Requires Playwright Chromium: npx playwright install chromium
 */

const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")
const { createSupabaseClient } = require("./lib/supabase-client.js")

const LISTING_URL = "https://www.broadsheet.com.au/melbourne/search/things-to-do"
const SOURCE_NAME = "Broadsheet"
const DEFAULT_CATEGORY = "Arts"
const MELBOURNE_TZ = "Australia/Melbourne"
const MAX_EVENT_DAYS_AHEAD = 30
const DETAIL_DELAY_MS = Number(process.env.DETAIL_DELAY_MS) || 200

const MONTHS = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
}

function loadEnvFile(filename) {
  const envPath = path.join(__dirname, filename)
  if (!fs.existsSync(envPath)) return false

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

  return true
}

function loadEnv() {
  if (!loadEnvFile(".env.local")) {
    loadEnvFile(".env")
  }
}

loadEnv()

let supabase
try {
  supabase = createSupabaseClient()
} catch (error) {
  console.error(error.message)
  process.exit(1)
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

function getDateWindowKeys() {
  const todayKey = formatDateKeyInTimeZone(new Date(), MELBOURNE_TZ)
  const maxKey = addDaysToDateKey(todayKey, MAX_EVENT_DAYS_AHEAD)
  return { todayKey, maxKey }
}

function toDateKey(year, monthIndex, day) {
  const y = String(year)
  const m = String(monthIndex + 1).padStart(2, "0")
  const d = String(day).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function toStartDatetime(dateKey) {
  return `${dateKey} 12:00:00`
}

function toEndDatetime(dateKey) {
  return `${dateKey} 23:59:00`
}

function isWithinDateWindow(startKey, endKey = null) {
  const start = startKey || endKey
  const end = endKey || startKey
  if (!start && !end) return false

  const { todayKey, maxKey } = getDateWindowKeys()
  const rangeStart = start || end
  const rangeEnd = end || start

  if (rangeStart >= todayKey && rangeStart <= maxKey) return true
  if (rangeEnd >= todayKey && rangeEnd <= maxKey) return true
  if (rangeStart <= todayKey && rangeEnd >= todayKey) return true

  return false
}

function parseMonth(name) {
  return MONTHS[(name || "").toLowerCase()]
}

function parseBroadsheetDateText(text) {
  if (!text) return null

  const normalized = text
    .replace(/\u2013|\u2014|–|—/g, "-")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const rangeWithTwoMonths = normalized.match(
    /(\d{1,2})(?:st|nd|rd|th)\s+([a-z]{3,9})\s*-\s*(\d{1,2})(?:st|nd|rd|th)\s+([a-z]{3,9})\s+(\d{4})/i
  )
  if (rangeWithTwoMonths) {
    const startMonth = parseMonth(rangeWithTwoMonths[2])
    const endMonth = parseMonth(rangeWithTwoMonths[4])
    const year = Number(rangeWithTwoMonths[5])
    if (startMonth !== undefined && endMonth !== undefined && year) {
      return {
        startKey: toDateKey(year, startMonth, Number(rangeWithTwoMonths[1])),
        endKey: toDateKey(year, endMonth, Number(rangeWithTwoMonths[3])),
      }
    }
  }

  const rangeSameMonth = normalized.match(
    /(\d{1,2})(?:st|nd|rd|th)\s*-\s*(\d{1,2})(?:st|nd|rd|th)\s+([a-z]{3,9})\s+(\d{4})/i
  )
  if (rangeSameMonth) {
    const month = parseMonth(rangeSameMonth[3])
    const year = Number(rangeSameMonth[4])
    if (month !== undefined && year) {
      return {
        startKey: toDateKey(year, month, Number(rangeSameMonth[1])),
        endKey: toDateKey(year, month, Number(rangeSameMonth[2])),
      }
    }
  }

  const singleDate = normalized.match(/(\d{1,2})(?:st|nd|rd|th)\s+([a-z]{3,9})\s+(\d{4})/i)
  if (singleDate) {
    const month = parseMonth(singleDate[2])
    const year = Number(singleDate[3])
    if (month !== undefined && year) {
      const startKey = toDateKey(year, month, Number(singleDate[1]))
      return { startKey, endKey: null }
    }
  }

  return null
}

function cleanImageUrl(url) {
  if (!url || url.startsWith("data:")) return ""
  try {
    const parsed = new URL(url)
    parsed.search = ""
    return parsed.toString()
  } catch {
    return url.split("?")[0]
  }
}

function splitVenueAndSuburb(venueName, addressText) {
  const venue = (venueName || "").trim()
  const address = (addressText || "").trim()

  if (!address) return { venue_name: venue, venue_suburb: "" }

  const suburbMatch = address.match(/,\s*([^,]+)\s*(?:VIC|Victoria|\d{4})?/i)
  if (suburbMatch) {
    return {
      venue_name: venue,
      venue_suburb: suburbMatch[1].trim(),
    }
  }

  const bits = address.split(",").map((b) => b.trim()).filter(Boolean)
  return {
    venue_name: venue,
    venue_suburb: bits.length > 0 ? bits[bits.length - 1] : "",
  }
}

function mapToDbRecord(event) {
  const { venue_name, venue_suburb } = splitVenueAndSuburb(event.venue_name, event.address)
  const baseDescription = event.description || ""
  const description = event.external_link
    ? `${baseDescription}\n\nExternal link: ${event.external_link}`.trim()
    : baseDescription

  return {
    title: event.title,
    description,
    start_datetime: toStartDatetime(event.startKey),
    end_datetime: toEndDatetime(event.endKey || event.startKey),
    venue_name,
    venue_suburb,
    category: DEFAULT_CATEGORY,
    vibes: [],
    price_range: "",
    image_url: cleanImageUrl(event.image_url),
    source_url: event.source_url,
    source_name: SOURCE_NAME,
    status: "approved",
    is_featured: false,
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

let warnedAboutColumns = false

async function insertEvent(record) {
  let { error } = await supabase.from("events").insert(record)

  if (error && /(source_name|status)/i.test(error.message)) {
    if (!warnedAboutColumns) {
      console.warn(
        "  Warning: events.source_name or events.status column missing — insert fallback omits those fields."
      )
      warnedAboutColumns = true
    }
    const { source_name: _sourceName, status: _status, ...withoutFields } = record
    ;({ error } = await supabase.from("events").insert(withoutFields))
  }

  if (error) {
    throw new Error(error.message)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function dismissOverlays(page) {
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("Allow all")',
    'button:has-text("I Agree")',
    '[aria-label="Close"]',
  ]

  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first()
      if (await button.isVisible({ timeout: 1200 })) {
        await button.click({ timeout: 1200 })
        await sleep(250)
      }
    } catch {
      // no overlay
    }
  }
}

async function scrollListingPage(page) {
  let previousHeight = -1

  for (let i = 0; i < 30; i++) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight)
    if (currentHeight === previousHeight) break
    previousHeight = currentHeight
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(800)
  }
}

async function extractListingUrls(page) {
  return page.evaluate(() => {
    function shouldKeep(pathname) {
      if (!pathname.includes("/melbourne/")) return false
      if (
        pathname.includes("/melbourne/search/") ||
        pathname.includes("/melbourne/category/") ||
        pathname.includes("/melbourne/suburb/") ||
        pathname.includes("/melbourne/guide/") ||
        pathname.includes("/melbourne/guides/") ||
        pathname.includes("/melbourne/city-file")
      ) {
        return false
      }
      return true
    }

    const urls = new Set()
    for (const anchor of document.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#")) continue

      let url
      try {
        url = new URL(href, window.location.origin)
      } catch {
        continue
      }

      if (!url.hostname.includes("broadsheet.com.au")) continue
      if (!shouldKeep(url.pathname)) continue

      url.hash = ""
      url.search = ""
      urls.add(url.toString())
    }
    return Array.from(urls)
  })
}

async function scrapeEventPage(page, sourceUrl) {
  await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 60000 })
  await dismissOverlays(page)
  await page.waitForTimeout(500)

  return page.evaluate(() => {
    function normalize(value) {
      return (value || "").replace(/\s+/g, " ").trim()
    }

    const title = normalize(document.querySelector("h1")?.textContent || "")

    const bodyText = normalize(document.body?.innerText || "")
    const rangeMatch = bodyText.match(
      /\b\d{1,2}(?:st|nd|rd|th)\s+[a-z]{3,9}\s*-\s*\d{1,2}(?:st|nd|rd|th)\s+[a-z]{3,9}\s+\d{4}\b/i
    )
    const singleMatch = bodyText.match(/\b\d{1,2}(?:st|nd|rd|th)\s+[a-z]{3,9}\s+\d{4}\b/i)
    const date_text = normalize(rangeMatch?.[0] || singleMatch?.[0] || "")

    const venueBlock = Array.from(document.querySelectorAll("section, div, article")).find((el) =>
      /where/i.test(el.textContent || "")
    )
    let venue_name = ""
    let address = ""
    if (venueBlock) {
      const text = normalize(venueBlock.textContent || "")
      const whereMatch = text.match(/where\s+([^|]+?)(?:\s+when\s+|$)/i)
      if (whereMatch) {
        const whereText = normalize(whereMatch[1])
        const parts = whereText.split(",").map((p) => p.trim()).filter(Boolean)
        venue_name = parts[0] || whereText
        address = whereText
      }
    }

    if (!venue_name) {
      const venueCandidate = document.querySelector('a[href*="/venues/"], a[href*="/venue/"]')
      venue_name = normalize(venueCandidate?.textContent || "")
    }

    const article = document.querySelector("article") || document.querySelector("main")
    const description = normalize(
      Array.from(article?.querySelectorAll("p") || [])
        .map((p) => normalize(p.textContent || ""))
        .filter(Boolean)
        .join(" ")
    )

    const heroFromMeta =
      document.querySelector('meta[property="og:image"]')?.getAttribute("content") || ""
    const heroFromImg =
      document.querySelector("main img")?.getAttribute("src") ||
      document.querySelector("article img")?.getAttribute("src") ||
      ""
    const image_url = normalize(heroFromMeta || heroFromImg)

    let external_link = ""
    for (const link of document.querySelectorAll("a[href]")) {
      const label = normalize(link.textContent || "")
      if (/book now|buy tickets|learn more/i.test(label)) {
        const href = link.getAttribute("href")
        if (href) {
          external_link = new URL(href, window.location.origin).toString()
          break
        }
      }
    }

    return {
      title,
      date_text,
      venue_name,
      address,
      description,
      image_url,
      external_link,
      source_url: window.location.href.split("#")[0],
    }
  })
}

async function main() {
  const { todayKey, maxKey } = getDateWindowKeys()
  console.log("Scraping Broadsheet Melbourne events")
  console.log(`Date filter: events overlapping ${todayKey} through ${maxKey} (Melbourne)`)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  let insertedCount = 0
  let duplicateCount = 0
  let skippedCount = 0
  let errorCount = 0

  try {
    console.log(`Loading listing page: ${LISTING_URL}`)
    await page.goto(LISTING_URL, { waitUntil: "domcontentloaded", timeout: 60000 })
    await dismissOverlays(page)
    await scrollListingPage(page)

    const listingUrls = await extractListingUrls(page)
    console.log(`Found ${listingUrls.length} candidate listing URLs`)

    for (let i = 0; i < listingUrls.length; i++) {
      const url = listingUrls[i]
      try {
        const event = await scrapeEventPage(page, url)
        const parsed = parseBroadsheetDateText(event.date_text)

        if (!event.title || !parsed?.startKey) {
          skippedCount++
          console.log(`  [${i + 1}/${listingUrls.length}] skipped: missing title/date ${url}`)
          continue
        }

        if (!isWithinDateWindow(parsed.startKey, parsed.endKey)) {
          skippedCount++
          console.log(`  [${i + 1}/${listingUrls.length}] skipped: outside date window ${event.title}`)
          continue
        }

        const sourceUrl = event.source_url || url
        if (await sourceUrlExists(sourceUrl)) {
          duplicateCount++
          console.log(`  [${i + 1}/${listingUrls.length}] duplicate: ${event.title}`)
          continue
        }

        const record = mapToDbRecord({
          ...event,
          source_url: sourceUrl,
          startKey: parsed.startKey,
          endKey: parsed.endKey,
        })

        await insertEvent(record)
        insertedCount++
        console.log(`  [${i + 1}/${listingUrls.length}] inserted: ${record.title}`)
      } catch (error) {
        errorCount++
        console.warn(`  [${i + 1}/${listingUrls.length}] error: ${error.message}`)
      }

      if (DETAIL_DELAY_MS > 0 && i < listingUrls.length - 1) {
        await sleep(DETAIL_DELAY_MS)
      }
    }

    console.log(
      `\nDone: ${insertedCount} inserted, ${duplicateCount} duplicates skipped, ${skippedCount} skipped, ${errorCount} errors`
    )
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error("Error:", error.message)
  process.exit(1)
})
