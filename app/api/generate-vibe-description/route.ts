import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const SYSTEM_PROMPT =
  "You are the voice of WSWD, a Melbourne events guide. Your job is to write a single one-liner description for an event. Tone: like a friend who actually goes out — direct, specific, warm, slightly irreverent, never corporate. No waffle. No 'don't miss out'. No 'unique experience'. Just one punchy sentence that makes someone want to go. Max 20 words."

const MODEL = "llama-3.1-8b-instant"
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

type GenerateVibeDescriptionPayload = {
  id?: string
  title?: string
  description?: string
  category?: string
  venue_name?: string
  venue_suburb?: string
  vibes?: string[]
}

const groqApiKey = process.env.GROQ_API_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function buildUserMessage(body: GenerateVibeDescriptionPayload): string {
  const vibes = Array.isArray(body.vibes) ? body.vibes.join(", ") : ""
  return [
    `Title: ${body.title || ""}`,
    `Category: ${body.category || ""}`,
    `Venue: ${body.venue_name || ""}`,
    `Suburb: ${body.venue_suburb || ""}`,
    `Vibes: ${vibes}`,
    `Description: ${body.description || ""}`,
    "",
    "Write one punchy one-liner for this event. Reply with only the sentence, no quotes.",
  ].join("\n")
}

export async function POST(request: Request) {
  try {
    console.log(
      "[generate-vibe-description] GROQ_API_KEY exists:",
      Boolean(process.env.GROQ_API_KEY)
    )

    if (!groqApiKey) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY environment variable" },
        { status: 500 }
      )
    }

    const body = (await request.json().catch(() => null)) as GenerateVibeDescriptionPayload | null
    if (!body?.title?.trim()) {
      return NextResponse.json({ error: "Missing required field: title" }, { status: 400 })
    }

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 120,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(body) },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Groq API error: ${errorText.slice(0, 300)}` },
        { status: 502 }
      )
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const description =
      data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") || ""

    if (!description) {
      return NextResponse.json({ error: "No description generated" }, { status: 502 })
    }

    if (body.id && supabaseUrl && serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
      const { error: updateError } = await supabaseAdmin
        .from("events")
        .update({ vibe_description: description })
        .eq("id", body.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ description })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error("[generate-vibe-description] Error:", message)
    if (stack) {
      console.error("[generate-vibe-description] Stack:", stack)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
