import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL = "llama-3.1-8b-instant"

const SYSTEM_PROMPT = `You are an event data extractor for WSWD, a Melbourne events guide. 
Given text (caption, flyer copy, article excerpt, URL content) about an event, extract structured data.
Return ONLY valid JSON with these exact fields:
{
  "title": "event name",
  "description": "1-3 sentence description of the event",
  "start_datetime": "ISO 8601 format e.g. 2026-06-15T19:00:00+10:00, or empty string if unknown",
  "end_datetime": "ISO 8601 format or empty string if unknown",
  "venue_name": "venue name or empty string",
  "venue_suburb": "Melbourne suburb or empty string",
  "source_url": "URL if present in the text or empty string",
  "image_url": "image URL if present or empty string",
  "category": "one of: Music, Arts, Food & Drink, Film & Media, Performing Arts, Nightlife, Fashion, Comedy, or Community Submission",
  "vibes": ["array of applicable vibes from: late-night, low-key, high-energy, free-cheap, solo-friendly, groups, date-night"]
}
If the current year is ambiguous, assume 2026. All times are Melbourne time (AEST UTC+10 or AEDT UTC+11).
Return ONLY the JSON object, no explanation, no markdown, no backticks.`

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
  source_url: string
  image_url: string
  category: string
  vibes: string[]
}

export async function POST(request: Request) {
  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as ParseEventPayload | null
  if (!body || (!body.text?.trim() && !body.imageBase64 && !body.source_url?.trim())) {
    return NextResponse.json(
      { error: "Provide at least one of: text, imageBase64, source_url" },
      { status: 400 }
    )
  }

  if (!body.text?.trim() && !body.imageBase64 && body.source_url?.trim()) {
    const { error } = await supabaseAdmin.from("events").insert({
      title: "Untitled (from shortcut)",
      description: "",
      start_datetime: "",
      end_datetime: "",
      venue_name: "",
      venue_suburb: "",
      category: "Community Submission",
      vibes: [],
      price_range: "",
      image_url: "",
      source_url: body.source_url.trim(),
      source_name: "iOS Shortcut",
      status: "pending",
      is_featured: false,
      is_curated_pick: false,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, message: "Saved as pending for manual review" })
  }

  const userContent: string[] = []
  if (body.text?.trim()) {
    userContent.push(`Event text:\n${body.text.trim()}`)
  }
  if (body.imageBase64) {
    userContent.push(
      `[Image provided — extract all visible text and event details from the flyer/image]`
    )
  }
  userContent.push("\nExtract the event details and return JSON only.")

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent.join("\n\n") },
  ]

  const groqResponse = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages,
      temperature: 0.1,
    }),
  })

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text()
    return NextResponse.json(
      { error: `Groq API error: ${errorText.slice(0, 300)}` },
      { status: 502 }
    )
  }

  const groqData = (await groqResponse.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const raw = groqData.choices?.[0]?.message?.content?.trim() || ""

  let parsed: ParsedEvent
  try {
    const clean = raw
      .replace(/```json|```/g, "")
      .replace(/[\u0000-\u001F\u007F]/g, (char) => {
        if (char === '\n' || char === '\r' || char === '\t') return ' '
        return ''
      })
      .trim()
    parsed = JSON.parse(clean) as ParsedEvent
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Groq response as JSON", raw },
      { status: 502 }
    )
  }

  await supabaseAdmin.from("events").insert({
    title: (parsed.title || "").trim(),
    description: (parsed.description || "").trim(),
    start_datetime: (parsed.start_datetime || "").trim(),
    end_datetime: (parsed.end_datetime || "").trim() || (parsed.start_datetime || "").trim(),
    venue_name: (parsed.venue_name || "").trim(),
    venue_suburb: (parsed.venue_suburb || "").trim(),
    category: (parsed.category || "Community Submission").trim(),
    vibes: Array.isArray(parsed.vibes) ? parsed.vibes : [],
    price_range: "",
    image_url: (parsed.image_url || "").trim(),
    source_url: (parsed.source_url || body.source_url || "").trim(),
    source_name: "iOS Shortcut",
    status: "pending",
    is_featured: false,
    is_curated_pick: false,
  })

  return NextResponse.json({ event: parsed })
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<ParsedEvent> | null
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: "Missing required field: title" }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from("events").insert({
    title: (body.title || "").trim(),
    description: (body.description || "").trim(),
    start_datetime: (body.start_datetime || "").trim(),
    end_datetime: (body.end_datetime || "").trim() || (body.start_datetime || "").trim(),
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
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}