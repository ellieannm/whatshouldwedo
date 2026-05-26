#!/usr/bin/env node

/**
 * Scrapes Melbourne events from Urban List roundup articles and inserts into Supabase.
 *
 * Usage:
 *   node fetch-urbanlist.js
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local or .env.
 * Requires Playwright Chromium: npx playwright install chromium
 */

const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")
const { createSupabaseClient } = require("./lib/supabase-client.js")

const ARTICLE_URLS = [
  "https://www.theurbanlist.com/melbourne/a-list/things-to-do-in-melbourne-this-weekend",
  "https://www.theurbanlist.com/melbourne/a-list/best-things-to-do-melbourne",
]

const SOURCE_NAME = "Urban List"
const DEFAULT_CATEGORY = "Arts"
const MELBOURNE_TZ = "Australia/Melbourne"
const MAX_EVENT_DAYS_AHEAD = 30
const DETAIL_DELAY_MS = Number(process.env.DETAIL_DELAY_MS) || 250

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

function inferYear(monthIndex, day, referenceKey) {
  const [refYear, refMonth, refDay] = referenceKey.split("-").map(Number)
  let year = refYear
  const candidate = new Date(year, monthIndex, day)
  const refDate = new Date(refYear, refMonth - 1, refDay)
  if (candidate < refDate) {
    const monthDiff = monthIndex - (refMonth - 1)
    if (monthDiff < -1) year += 1
  }
  return year
}

function parseDayMonth(match, referenceKey) {
  let day
  let monthName
  let explicitYear

  if (/^\d/.test(match[1])) {
    day = Number(match[1])
    monthName = match[2].toLowerCase()
    explicitYear = match[3] ? Number(match[3]) : null
  } else {
    monthName = match[1].toLowerCase()
    day = Number(match[2])
    explicitYear = match[3] ? Number(match[3]) : null
  }

  const monthIndex = MONTHS[monthName]
  if (monthIndex === undefined || !day) return null

  const year = explicitYear ?? inferYear(monthIndex, day, referenceKey)
  return toDateKey(year, monthIndex, day)
}

function parseFirstDateKey(text, referenceKey) {
  if (!text) return null

  const normalized = text
    .replace(/\u2013|\u2014|–|—/g, "-")
    .replace(/\s+/g, " ")
    .trim()

  const dayRangeMonth = normalized.match(
    /\b(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/i
  )
  if (dayRangeMonth) {
    const key = parseDayMonth(
      ["", dayRangeMonth[1], dayRangeMonth[3], dayRangeMonth[4]],
      referenceKey
    )
    if (key) return key
  }

  const weekdayDate = normalized.match(
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})(?:\s+and\s+(?:\w+\s+)?\d{1,2})?\s+([A-Za-z]+)(?:\s+(\d{4}))?/i
  )
  if (weekdayDate) {
    const key = parseDayMonth(
      ["", weekdayDate[1], weekdayDate[2], weekdayDate[3]],
      referenceKey
    )
    if (key) return key
  }

  const patterns = [
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?/gi,
    /\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/gi,
  ]

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    const match = pattern.exec(normalized)
    if (match) {
      const key = parseDayMonth(match, referenceKey)
      if (key) return key
    }
  }

  return null
}

function parseLastDateKey(text, referenceKey) {
  if (!text) return null

  const normalized = text
    .replace(/\u2013|\u2014|–|—/g, "-")
    .replace(/\s+/g, " ")
    .trim()

  const patterns = [
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?/gi,
    /\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/gi,
  ]

  let lastKey = null
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(normalized)) !== null) {
      const key = parseDayMonth(match, referenceKey)
      if (key) lastKey = key
    }
  }
  return lastKey
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

function toStartDatetime(dateKey) {
  return `${dateKey} 12:00:00`
}

function toEndDatetime(dateKey) {
  return dateKey ? `${dateKey} 23:59:00` : ""
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
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

function splitVenueAndSuburb(h4Text) {
  const venuePart = (h4Text.split("|")[0] || "").trim()
  if (!venuePart) return { venue_name: "", venue_suburb: "" }

  const commaParts = venuePart.split(",").map((p) => p.trim())
  if (commaParts.length >= 2) {
    return {
      venue_name: commaParts[0],
      venue_suburb: commaParts[commaParts.length - 1],
    }
  }

  return { venue_name: venuePart, venue_suburb: "" }
}

function isExternalUrl(href) {
  if (!href) return false
  try {
    const hostname = new URL(href).hostname.toLowerCase()
    return !hostname.includes("theurbanlist.com")
  } catch {
    return false
  }
}

function mapToDbRecord({
  title,
  description,
  startKey,
  endKey,
  venueText,
  image_url,
  source_url,
}) {
  const { venue_name, venue_suburb } = splitVenueAndSuburb(venueText || "")

  return {
    title,
    description: description || "",
    start_datetime: toStartDatetime(startKey),
    end_datetime: endKey ? toEndDatetime(endKey) : toEndDatetime(startKey),
    venue_name,
    venue_suburb,
    category: DEFAULT_CATEGORY,
    vibe: "",
    price_range: "",
    image_url: cleanImageUrl(image_url),
    source_url,
    source_name: SOURCE_NAME,
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

let warnedAboutSourceName = false

async function insertEvent(record) {
  let { error } = await supabase.from("events").insert(record)

  if (error && /source_name/.test(error.message)) {
    if (!warnedAboutSourceName) {
      console.warn(
        "  Warning: events.source_name column missing — re-run after: ALTER TABLE events ADD COLUMN source_name text;"
      )
      warnedAboutSourceName = true
    }
    const { source_name: _sourceName, ...withoutSourceName } = record
    ;({ error } = await supabase.from("events").insert(withoutSourceName))
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
    'button:has-text("I Agree")',
    'button:has-text("Got it")',
    '[aria-label="Close"]',
  ]

  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first()
      if (await button.isVisible({ timeout: 1500 })) {
        await button.click({ timeout: 1500 })
        await sleep(300)
      }
    } catch {
      // no overlay
    }
  }
}

async function scrapeArticle(page) {
  return page.evaluate(() => {
    const content = document.querySelector(".editable-content")
    if (!content) {
      return { articleUrl: window.location.href.split("#")[0], items: [] }
    }

    function normalizeText(value) {
      return value.replace(/\s+/g, " ").trim()
    }

    function parseH4Lines(h4) {
      const lines = h4.innerText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
      const venueLine = lines.find((line) => line.includes("|")) || ""
      const titleLine = lines.find((line) => !line.includes("|")) || ""
      return { titleLine, venueLine }
    }

    function getAnchorId(element) {
      const anchorEl =
        element.querySelector("[id], [name]") ||
        element.closest("[id], [name]") ||
        element
      return anchorEl.id || anchorEl.getAttribute("name") || ""
    }

    function isEventHeading(element) {
      return element && (element.tagName === "H2" || element.tagName === "H3")
    }

    function isNextEventHeading(element) {
      if (!element) return false
      if (element.tagName === "H2" || element.tagName === "H3") return true
      if (element.tagName === "H4" && element.textContent.includes("|")) {
        return true
      }
      return false
    }

    function collectBlockContent(startElement) {
      let image_url = ""
      let description = ""
      const externalLinks = []

      let node = startElement.nextElementSibling
      while (node && !isNextEventHeading(node)) {
        if (!image_url) {
          const img =
            node.tagName === "IMG" ? node : node.querySelector?.("img")
          if (img?.src && !img.src.startsWith("data:")) {
            image_url = img.src
          }
        }

        if (node.tagName === "P") {
          const text = normalizeText(node.textContent)
          if (text) description += `${text} `

          for (const link of node.querySelectorAll('a[target="_blank"]')) {
            if (link.href) externalLinks.push(link.href)
          }
        }

        node = node.nextElementSibling
      }

      return {
        image_url,
        description: description.trim(),
        externalLinks,
      }
    }

    const items = []
    const consumedH4 = new Set()
    const headings = Array.from(content.querySelectorAll("h2, h3, h4"))

    function pushItem({ titleEl, h4El, title, venueDateText }) {
      if (!title || !venueDateText.includes("|") || consumedH4.has(h4El)) return

      const block = collectBlockContent(h4El)
      const anchorId = getAnchorId(titleEl || h4El)

      items.push({
        title,
        venueDateText,
        image_url: block.image_url,
        description: block.description,
        externalLinks: block.externalLinks,
        anchorId,
      })
      consumedH4.add(h4El)
    }

    for (let index = 0; index < headings.length; index++) {
      const element = headings[index]
      const tag = element.tagName

      if (tag === "H4") {
        if (consumedH4.has(element) || !element.textContent.includes("|")) {
          continue
        }

        const { titleLine, venueLine } = parseH4Lines(element)
        const prev = headings[index - 1]
        let title = titleLine
        let titleEl = element

        if (!title && prev?.tagName === "H3") {
          title = normalizeText(prev.textContent)
          titleEl = prev
        }

        if (!title) {
          title = venueLine.split("|")[0].trim()
        }

        pushItem({
          titleEl,
          h4El: element,
          title,
          venueDateText: venueLine || normalizeText(element.textContent),
        })
        continue
      }

      if (tag !== "H2" && tag !== "H3") continue

      const headingTitle = normalizeText(element.textContent)
      if (!headingTitle || /you might also like/i.test(headingTitle)) continue

      const next = headings[index + 1]
      if (!next || next.tagName !== "H4" || !next.textContent.includes("|")) {
        continue
      }

      const { titleLine, venueLine } = parseH4Lines(next)

      if (titleLine) {
        pushItem({
          titleEl: next,
          h4El: next,
          title: titleLine,
          venueDateText: venueLine,
        })
      } else {
        pushItem({
          titleEl: element,
          h4El: next,
          title: headingTitle,
          venueDateText: normalizeText(next.textContent),
        })
      }
    }

    return {
      articleUrl: window.location.href.split("#")[0],
      items,
    }
  })
}

function parseArticleItems(items, articleUrl, referenceKey) {
  const events = []

  for (const item of items) {
    const pipeParts = item.venueDateText.split("|").map((p) => p.trim())
    const venueText = pipeParts[0] || ""
    const dateText =
      pipeParts.length >= 2 ? pipeParts.slice(1).join("|").trim() : item.venueDateText

    const startKey = parseFirstDateKey(dateText, referenceKey)
    const endKey = parseLastDateKey(dateText, referenceKey)
    if (!isWithinDateWindow(startKey, endKey)) continue

    const externalUrls = item.externalLinks.filter(isExternalUrl)
    const anchor = item.anchorId || slugify(item.title)
    const source_url =
      externalUrls.length > 0
        ? externalUrls[externalUrls.length - 1]
        : `${articleUrl}#${anchor}`

    events.push({
      title: item.title,
      description: item.description,
      startKey,
      endKey: endKey && endKey !== startKey ? endKey : null,
      venueText,
      image_url: item.image_url,
      source_url,
    })
  }

  return events
}

async function main() {
  const { todayKey, maxKey } = getDateWindowKeys()
  console.log(`Scraping ${ARTICLE_URLS.length} Urban List articles`)
  console.log(
    `Date filter: events overlapping ${todayKey} through ${maxKey} (Melbourne)`
  )

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.route("**/*", (route) => {
    const type = route.request().resourceType()
    if (["image", "font", "media"].includes(type)) {
      route.abort()
    } else {
      route.continue()
    }
  })

  let insertedCount = 0
  let duplicateCount = 0
  let skippedCount = 0
  let errorCount = 0

  try {
    for (let a = 0; a < ARTICLE_URLS.length; a++) {
      const articleUrl = ARTICLE_URLS[a]
      console.log(`\n=== Article ${a + 1}/${ARTICLE_URLS.length} ===\n${articleUrl}`)

      try {
        await page.goto(articleUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        })
        await dismissOverlays(page)
        await page.waitForSelector(".editable-content", { timeout: 30000 })

        const scraped = await scrapeArticle(page)
        const events = parseArticleItems(scraped.items, scraped.articleUrl, todayKey)

        console.log(
          `  Found ${scraped.items.length} event blocks, ${events.length} within date window`
        )

        for (const event of events) {
          if (!event.source_url) {
            skippedCount++
            continue
          }

          if (await sourceUrlExists(event.source_url)) {
            duplicateCount++
            console.log(`  duplicate: ${event.title}`)
            continue
          }

          const record = mapToDbRecord(event)
          await insertEvent(record)
          insertedCount++
          console.log(
            `  inserted: ${record.title} (${record.start_datetime.slice(0, 10)}) → ${record.source_url}`
          )
        }

        const outOfWindow = scraped.items.length - events.length
        if (outOfWindow > 0) {
          skippedCount += outOfWindow
        }
      } catch (error) {
        errorCount++
        console.warn(`  error: ${error.message}`)
      }

      if (DETAIL_DELAY_MS > 0 && a < ARTICLE_URLS.length - 1) {
        await sleep(DETAIL_DELAY_MS)
      }
    }

    console.log(
      `\nDone: ${insertedCount} inserted, ${duplicateCount} duplicates skipped, ${skippedCount} out of window or missing URL, ${errorCount} errors`
    )
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error("Error:", error.message)
  process.exit(1)
})
