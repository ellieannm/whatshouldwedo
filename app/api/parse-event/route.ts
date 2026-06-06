import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL = "llama-3.3-70b-versatile"
const APIFY_ACTOR_ID = "apify~instagram-scraper"

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

type ParseEventPayload = {
  text?: string
  imageBase64?: string
  imageMediaType?: string
  source_url?: string
}

type ParsedEvent = {
  title: string
  description: string
  start_datetime: string
  end_datetime: string
  venue_name: string
  venue_suburb: string
  source_url?: string
  image_url: string
  category: string
  vibes: string[]
}

type ApifyResult = {
  caption?: string
  displayUrl?: string
  images?: string[]
  url?: string
  locationName?: string
  ownerUsername?: string
  ownerFullName?: string
  taggedUsers?: Array<{ full_name: string; username: string }>
  childPosts?: Array<{
    displayUrl?: string
    taggedUsers?: Array<{ full_name: string; username: string }>
  }>
}

async function fetchInstagramData(instagramUrl: string): Promise<ApifyResult | null> {
  const apifyToken = process.env.APIFY_API_TOKEN
  if (!apifyToken) {
    console.error("[parse-event] Missing APIFY_API_TOKEN")
    return null
  }

  // Start Apify run
  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${apifyToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [instagramUrl],
        resultsType: "posts",
        resultsLimit: 1,
      }),
    }
  )

  if (!runResponse.ok) {
    console.error("[parse-event] Apify run failed:", await runResponse.text())
    return null
  }

  const runData = (await runResponse.json()) as { data?: { id?: string; defaultDatasetId?: string } }
  const datasetId = runData.data?.defaultDatasetId
  const runId = runData.data?.id

  if (!datasetId || !runId) {
    console.error("[parse-event] No dataset ID from Apify")
    return null
  }

  // Poll for completion (max 30 seconds)
  for (let i = 0; i < 15; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
    )
    const statusData = (await statusResponse.json()) as { data?: { status?: string } }
    const status = statusData.data?.status

    if (status === "SUCCEEDED") break
    if (status === "FAILED" || status === "ABORTED") {
      console.error("[parse-event] Apify run failed with status:", status)
      return null
    }
  }

  // Fetch results
  const resultsResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`
  )
  const results = (await resultsResponse.json()) as ApifyResult[]

  return results?.[0] || null
}

async function parseWithGroq(
  caption: string,
  images: string[],
  taggedUsers: Array<{ full_name: string; username: string }>,
  childPosts: Array<{ displayUrl?: string; taggedUsers?: Array<{ full_name: string; username: string }> }>,
  sourceUrl: string
): Promise<ParsedEvent[]> {
  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) throw new Error("Missing GROQ_API_KEY")

  // Build a rich context string for Groq
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
    throw new Error(`Groq API error: ${await groqResponse.text()}`)
  }

  const groqData = (await groqResponse.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const raw = groqData.choices?.[0]?.message?.content?.trim() || ""

  let parsed: ParsedEvent[]
  try {
    let clean = raw.replace(/```json|```/g, "").trim()
    clean = clean.replace(/[\u0000-\u001F\u007F]/g, (char) => {
      if (char === "\n" || char === "\r" || char === "\t") return " "
      return ""
    })
    // Extract JSON array
    const arrayMatch = clean.match(/\[[\s\S]*\]/)
    if (!arrayMatch) throw new Error("No JSON array found")
    parsed = JSON.parse(arrayMatch[0]) as ParsedEvent[]
  } catch {
    throw new Error(`Failed to parse Groq response: ${raw.slice(0, 200)}`)
  }

  return parsed
}

async function saveEvents(events: ParsedEvent[], sourceUrl: string): Promise<void> {
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
      console.error("[parse-event] Insert error:", error.message, "for event:", event.title)
    }
  }
}

// POST — parse text/image from admin or shortcut
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ParseEventPayload | null

  if (!body || (!body.text?.trim() && !body.imageBase64 && !body.source_url?.trim())) {
    return NextResponse.json(
      { error: "Provide at least one of: text, imageBase64, source_url" },
      { status: 400 }
    )
  }

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 })
  }

  const sourceUrl = body.source_url?.trim() || ""
  const isInstagramUrl = sourceUrl.includes("instagram.com")

  // Instagram URL — use Apify to get real content
  if (isInstagramUrl && sourceUrl) {
    const igData = await fetchInstagramData(sourceUrl)

    if (!igData) {
      // Fallback: save bare pending event with just the URL
      await supabaseAdmin.from("events").insert({
        title: "Untitled (Instagram)",
        description: "",
        venue_name: "",
        venue_suburb: "",
        category: "Community Submission",
        vibes: [],
        price_range: "",
        image_url: "",
        source_url: sourceUrl,
        source_name: "Instagram",
        status: "pending",
        is_featured: false,
        is_curated_pick: false,
      })
      return NextResponse.json({
        success: true,
        message: "Saved as pending (Apify unavailable)",
        count: 1,
      })
    }

    const caption = igData.caption || ""
    const images = igData.images || (igData.displayUrl ? [igData.displayUrl] : [])
    const taggedUsers = igData.taggedUsers || []
    const childPosts = igData.childPosts || []

    try {
      const events = await parseWithGroq(caption, images, taggedUsers, childPosts, sourceUrl)
      await saveEvents(events, sourceUrl)
      return NextResponse.json({
        success: true,
        count: events.length,
        events,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  // Text/image input — direct Groq parse (admin Parse Event tab)
  const userContent: string[] = []
  if (body.text?.trim()) userContent.push(`Event text:\n${body.text.trim()}`)
  if (body.imageBase64) userContent.push(`[Image uploaded — extract all visible event details]`)
  userContent.push("\nReturn a JSON array of events.")

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
        { role: "user", content: userContent.join("\n\n") },
      ],
    }),
  })

  if (!groqResponse.ok) {
    return NextResponse.json(
      { error: `Groq error: ${await groqResponse.text()}` },
      { status: 502 }
    )
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
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Groq response", raw },
      { status: 502 }
    )
  }

  return NextResponse.json({ events })
}

// PUT — save reviewed event from admin Parse Event tab
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<ParsedEvent> | null
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: "Missing required field: title" }, { status: 400 })
  }

  const insertData: Record<string, unknown> = {
    title: (body.title || "").trim(),
    description: (body.description || "").trim(),
    venue_name: (body.venue_name || "").trim(),
    venue_suburb: (body.venue_suburb || "").trim(),
    category: (body.category || "Community Submission").trim(),
    vibes: Array.isArray(body.vibes) ? body.vibes : [],
    price_range: "",
    image_url: (body.image_url || "").trim(),
    source_url: (body.source_url || "").trim(),
    source_name: "Parsed (Admin)",
    status: "pending",
    is_featured: false,
    is_curated_pick: false,
  }

  if (body.start_datetime?.trim()) insertData.start_datetime = body.start_datetime.trim()
  if (body.end_datetime?.trim()) insertData.end_datetime = body.end_datetime.trim()

  const { error } = await supabaseAdmin.from("events").insert(insertData)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
