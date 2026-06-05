import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

type UpdateStatusPayload = {
  eventId?: string
  status?: string
}

const ALLOWED_STATUSES = new Set(["approved", "rejected", "pending"])

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  )
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as UpdateStatusPayload | null
  if (!body?.eventId?.trim()) {
    return NextResponse.json({ error: "Missing required field: eventId" }, { status: 400 })
  }

  const status = (body.status || "").trim()
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: 'status must be "approved", "rejected", or "pending"' },
      { status: 400 }
    )
  }

  const { error: updateError } = await supabaseAdmin
    .from("events")
    .update({ status })
    .eq("id", body.eventId.trim())

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ status })
}
