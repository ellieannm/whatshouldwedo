import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

type SubmitEventPayload = {
  title?: string
  description?: string
  start_datetime?: string
  end_datetime?: string
  venue_name?: string
  venue_suburb?: string
  source_url?: string
  image_url?: string
  submitter_name?: string
  submitter_email?: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  )
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SubmitEventPayload | null
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const submitterName = (body.submitter_name || "").trim()
  const submitterEmail = (body.submitter_email || "").trim()
  const sourceName = submitterName
    ? `Submitted by ${submitterName}`
    : "Submitted (Anonymous)"

  const finalDescription =
    submitterName || submitterEmail
      ? `${(body.description || "").trim()}\n\nSubmitted by: ${submitterName || "Anonymous"}${
          submitterEmail ? ` (${submitterEmail})` : ""
        }`
      : (body.description || "").trim()

  const requiredFields: Array<keyof SubmitEventPayload> = [
    "title",
    "description",
    "start_datetime",
    "venue_name",
    "venue_suburb",
    "source_url",
  ]

  for (const field of requiredFields) {
    if (!body[field] || !String(body[field]).trim()) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  const { error } = await supabaseAdmin.from("events").insert({
    title: (body.title || "").trim(),
    description: finalDescription,
    start_datetime: (body.start_datetime || "").trim(),
    end_datetime: (body.end_datetime || "").trim() || (body.start_datetime || "").trim(),
    venue_name: (body.venue_name || "").trim(),
    venue_suburb: (body.venue_suburb || "").trim(),
    category: "Community Submission",
    vibes: [],
    price_range: "",
    image_url: (body.image_url || "").trim(),
    source_url: (body.source_url || "").trim(),
    source_name: sourceName,
    status: "pending",
    is_featured: false,
    is_curated_pick: false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
