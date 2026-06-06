import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL = "llama-3.3-70b-versatile"

const SYSTEM_PROMPT = `You are an event data extractor for WSWD, a curated Melbourne events guide.

Given Instagram post data (caption, images, tagged users), extract ALL distinct events mentioned.

Rules:
- If the post is about ONE event: return an array with one event object
- If the post is about MULTIPLE events (roundup post): return an array with one object per event
- For roundups, match each event to its slide image using the tagged users list — the order of tagged users matches the order of slides
- If a date is not mentioned, leave start_datetime and end_datetime as empty strings
- All times are Melbourne time (AEST UTC+10 or AEDT UTC+11)
- If year is ambiguous, assume 2026
- For image_url: use the slide image that corresponds to that event, or the first image if unsure
- For venue_suburb: extract Melbourne suburb if mentioned, otherwise leave empty

Return ONLY a valid JSON array, no explanation, no markdown, no backticks:
[
  {
    "title": "event name",
    "description": "1-2 sentence description",
    "start_datetime": "ISO 8601 e.g. 2026-06-15T19:00:00+10:00 or empty string",
    "end_datetime": "ISO 8601 or empty string",
    "venue_name": "venue name or empty string",
    "venue_suburb": "Melbourne suburb or empty string",
    "image_url": "image URL for this specific event",
    "category": "one of: Music, Arts, Food & Drink, Film & Media, Performing Arts, Nightlife, Fashion, Comedy, Community Submission",
    "vibes": ["from: late-night, low-key, high-energy, free-cheap, solo-friendly, groups, date-night"]
  }
]`

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

type ParsedEvent = {
  title: string
  description: string
  start_datetime: string
  end_datetime: string
  venue_name: string
  venue_suburb: string
  image_url: string
  category: string
  vibes: string[]
}

type ApifyWebhookBody = {
  eventData?: {
    actorRunId?: string
  }
  resource?: {
    defaultDatasetId?: string
    status?: string
  }
}

type ApifyResult = {
  caption?: string
  displayUrl?: string
  images?: string[]
  url?: string
  locationName?: string
  ownerUsername?: string
  taggedUsers?: Array<{ full_name: string; username: string }>
  childPosts?: Array<{
    displayUrl?: string
    taggedUsers?: Array<{ full_name: string; username: string }>
  }>
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ApifyWebhookBody | null

  if (!body) {
    return NextResponse.json({ error: "Invalid webhook body" }, { status: 400 })
  }

  const datasetId = body.resource?.defaultDatasetId
  const status = body.resource?.status

  if (status !== "SUCCEEDED" || !datasetId) {
    console.log("[apify-webhook] Run not succeeded or no dataset:", status)
    return NextResponse.json({ ok: true })
  }

  const apifyToken = process.env.APIFY_API_TOKEN
  if (!apifyToken) {
    return NextResponse.json({ error: "Missing APIFY_API_TOKEN" }, { status: 500 })
  }

  // Fetch results from Apify dataset
  const resultsResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`
  )
  const results = (await resultsResponse.json()) as ApifyResult[]
  const igData = results?.[0]

  if (!igData) {
    console.error("[apify-webhook] No results in dataset")
    return NextResponse.json({ ok: true })
  }

  const caption = igData.caption || ""
  const images = igData.images || (igData.displayUrl ? [igData.displayUrl] : [])
  const taggedUsers = igData.taggedUsers || []
  const childPosts = igData.childPosts || []
  const sourceUrl = igData.url || ""

  // Build context for Groq
  const slideInfo = childPosts.length > 0
    ? childPosts.map((post, i) => {
        const tags = post.taggedUsers?.map((u) => u.full_name).join(", ") || "none"
        return `Slide ${i + 1}: image=${post.displayUrl || images[i] || ""}, tagged=${tags}`
      }).join("\n")
    : `Single image: ${images[0] || ""}`

  const taggedNames = taggedUsers.map((u) => u.full_name).join(", ")

  const userMessage = `Instagram post URL: ${sourceUrl}

Caption:
${caption}

Images/Slides:
${slideInfo}

Tagged users overall: ${taggedNames}

Extract all events from this post and return a JSON array.`

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 })
  }

  const groqResponse = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  })

  if (!groqResponse.ok) {
    console.error("[apify-webhook] Groq error:", await groqResponse.text())
    return NextResponse.json({ ok: true })
  }

  const groqData = (await groqResponse.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const raw = groqData.choices?.[0]?.message?.content?.trim() || ""

  let events: ParsedEvent[]
  try {
    let clean = raw.replace(/```json|```/g, "").trim()
    clean = clean.replace(/[\u0000-\u001F\u007F]/g, (char) => {
      if (char === "\n" || char === "\r" || char === "\t") return " "
      return ""
    })
    const arrayMatch = clean.match(/\[[\s\S]*\]/)
    if (!arrayMatch) throw new Error("No JSON array found")
    events = JSON.parse(arrayMatch[0]) as ParsedEvent[]
  } catch (err) {
    console.error("[apify-webhook] Parse error:", err)
    return NextResponse.json({ ok: true })
  }

  // Save each event to Supabase
  for (const event of events) {
    const insertData: Record<string, unknown> = {
      title: (event.title || "Untitled").trim(),
      description: (event.description || "").trim(),
      venue_name: (event.venue_name || "").trim(),
      venue_suburb: (event.venue_suburb || "").trim(),
      category: (event.category || "Community Submission").trim(),
      vibes: Array.isArray(event.vibes) ? event.vibes : [],
      price_range: "",
      image_url: (event.image_url || "").trim(),
      source_url: sourceUrl,
      source_name: "Instagram",
      status: "pending",
      is_featured: false,
      is_curated_pick: false,
    }

    if (event.start_datetime?.trim()) insertData.start_datetime = event.start_datetime.trim()
    if (event.end_datetime?.trim()) insertData.end_datetime = event.end_datetime.trim()

    const { error } = await supabaseAdmin.from("events").insert(insertData)
    if (error) {
      console.error("[apify-webhook] Insert error:", error.message)
    } else {
      console.log("[apify-webhook] Saved event:", event.title)
    }
  }

  return NextResponse.json({ ok: true, saved: events.length })
}
