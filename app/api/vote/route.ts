import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

type VotePayload = {
  eventId?: string
  direction?: "up" | "down"
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.error("[vote] env check:", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    })

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[vote] missing env vars — cannot create Supabase client")
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      )
    }

    const body = (await request.json().catch((parseError) => {
      console.error("[vote] failed to parse request body:", parseError)
      return null
    })) as VotePayload | null

    if (!body?.eventId?.trim()) {
      console.error("[vote] missing eventId in body:", body)
      return NextResponse.json({ error: "Missing required field: eventId" }, { status: 400 })
    }

    if (body.direction !== "up" && body.direction !== "down") {
      console.error("[vote] invalid direction:", body.direction)
      return NextResponse.json(
        { error: 'direction must be "up" or "down"' },
        { status: 400 }
      )
    }

    const delta = body.direction === "up" ? 1 : -1
    const eventId = body.eventId.trim()

    console.error("[vote] request received:", {
      eventId,
      eventIdType: typeof eventId,
      direction: body.direction,
      delta,
    })

    let supabaseAdmin
    try {
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
      console.error("[vote] Supabase client created successfully")
    } catch (clientError) {
      console.error("[vote] failed to create Supabase client:", clientError)
      return NextResponse.json({ error: "Failed to create Supabase client" }, { status: 500 })
    }

    const { data: rows, error: fetchError, status: fetchStatus, statusText: fetchStatusText } =
      await supabaseAdmin.from("events").select("id, votes").eq("id", eventId).limit(1)

    console.error("[vote] fetch query result:", {
      eventId,
      fetchStatus,
      fetchStatusText,
      rowCount: rows?.length ?? 0,
      rows,
      fetchError: fetchError
        ? {
            message: fetchError.message,
            code: fetchError.code,
            details: fetchError.details,
            hint: fetchError.hint,
          }
        : null,
    })

    if (fetchError) {
      console.error("[vote] fetch failed — aborting before update")
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const event = rows?.[0]
    if (!event) {
      console.error("[vote] event not found for eventId:", eventId)
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const currentVotes = Number(event.votes) || 0
    const newVotes = currentVotes + delta

    console.error("[vote] preparing update:", {
      eventId,
      currentVotes,
      delta,
      newVotes,
    })

    const {
      data: updateData,
      error: updateError,
      status: updateStatus,
      statusText: updateStatusText,
    } = await supabaseAdmin.from("events").update({ votes: newVotes }).eq("id", eventId).select("id, votes")

    console.error("[vote] update query result:", {
      eventId,
      updateStatus,
      updateStatusText,
      updateData,
      updateError: updateError
        ? {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint,
          }
        : null,
    })

    if (updateError) {
      console.error("[vote] update failed — returning 500")
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.error("[vote] success:", { eventId, votes: newVotes })
    return NextResponse.json({ votes: newVotes })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error("[vote] unexpected error:", message)
    if (stack) {
      console.error("[vote] stack:", stack)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
