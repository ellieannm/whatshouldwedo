"use client"

import { useEffect, useRef, useState } from "react"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { formatEventDateRange } from "@/lib/melbourne-dates"

const VOTES_STORAGE_KEY = "wswd-event-votes"

type VoteDirection = "up" | "down"

function readVoteFromStorage(eventId: string): VoteDirection | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(VOTES_STORAGE_KEY)
    if (!raw) return null
    const record = JSON.parse(raw) as Record<string, VoteDirection>
    return record[eventId] ?? null
  } catch {
    return null
  }
}

function writeVoteToStorage(eventId: string, direction: VoteDirection) {
  if (typeof window === "undefined") return

  try {
    const raw = window.localStorage.getItem(VOTES_STORAGE_KEY)
    const record = raw ? (JSON.parse(raw) as Record<string, VoteDirection>) : {}
    record[eventId] = direction
    window.localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // private browsing / storage full
  }
}

function removeVoteFromStorage(eventId: string) {
  if (typeof window === "undefined") return

  try {
    const raw = window.localStorage.getItem(VOTES_STORAGE_KEY)
    if (!raw) return
    const record = JSON.parse(raw) as Record<string, VoteDirection>
    delete record[eventId]
    window.localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // ignore
  }
}

interface EventCardProps {
  id: string
  title: string
  category: string
  date: string
  start_datetime: string
  end_datetime?: string
  location: string
  image_url: string
  source_url?: string
  vibe_description?: string
  votes?: number
  onVotesChange?: (eventId: string, newVotes: number) => void
}

export function EventCard({
  id,
  title,
  category,
  date,
  start_datetime,
  end_datetime,
  location,
  image_url,
  source_url,
  vibe_description,
  votes = 0,
  onVotesChange,
}: EventCardProps) {
  const [imageError, setImageError] = useState(false)
  const [displayVotes, setDisplayVotes] = useState(() => Number(votes) || 0)
  const [userVote, setUserVote] = useState<VoteDirection | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)
  const isVotingRef = useRef(false)

  useEffect(() => {
    setDisplayVotes(Number(votes) || 0)
  }, [votes])

  useEffect(() => {
    setUserVote(readVoteFromStorage(id))
  }, [id])

  const showPlaceholder = !image_url?.trim() || imageError
  const href = source_url?.trim() || "#"
  const displayDate =
    start_datetime?.trim()
      ? formatEventDateRange(start_datetime, end_datetime)
      : date

  const canInteractWithVote = (direction: VoteDirection) => {
    if (!userVote) return true
    if (userVote === direction) return true
    return false
  }

  const revertVote = (previousVotes: number, restoreVote: VoteDirection | null) => {
    setDisplayVotes(previousVotes)
    onVotesChange?.(id, previousVotes)
    if (restoreVote) {
      writeVoteToStorage(id, restoreVote)
      setUserVote(restoreVote)
    } else {
      removeVoteFromStorage(id)
      setUserVote(null)
    }
  }

  const syncVote = async (
    direction: VoteDirection,
    previousVotes: number,
    optimisticVotes: number,
    restoreVoteOnFailure: VoteDirection | null
  ) => {
    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id, direction }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        votes?: number
        error?: string
      }

      if (!response.ok) {
        console.error("[vote] API error:", payload.error || response.status)
        setVoteError(payload.error || "Vote failed")
        revertVote(previousVotes, restoreVoteOnFailure)
        return
      }

      const newVotes = typeof payload.votes === "number" ? payload.votes : optimisticVotes
      setDisplayVotes(newVotes)
      onVotesChange?.(id, newVotes)
      setVoteError(null)
    } catch (error) {
      console.error("[vote] network error:", error)
      setVoteError("Vote failed")
      revertVote(previousVotes, restoreVoteOnFailure)
    } finally {
      isVotingRef.current = false
    }
  }

  const handleVoteClick = (direction: VoteDirection) => {
    if (typeof window === "undefined") return
    if (isVotingRef.current || !canInteractWithVote(direction)) return

    isVotingRef.current = true
    setVoteError(null)

    const previousVotes = displayVotes

    if (userVote === direction) {
      const undoDirection: VoteDirection = direction === "up" ? "down" : "up"
      const optimisticVotes = previousVotes + (direction === "up" ? -1 : 1)

      setDisplayVotes(optimisticVotes)
      onVotesChange?.(id, optimisticVotes)
      removeVoteFromStorage(id)
      setUserVote(null)

      void syncVote(undoDirection, previousVotes, optimisticVotes, direction)
      return
    }

    const optimisticVotes = previousVotes + (direction === "up" ? 1 : -1)

    setDisplayVotes(optimisticVotes)
    onVotesChange?.(id, optimisticVotes)
    writeVoteToStorage(id, direction)
    setUserVote(direction)

    void syncVote(direction, previousVotes, optimisticVotes, null)
  }

  return (
    <article className="group relative isolate flex w-full flex-col overflow-visible">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-0 block w-full cursor-pointer no-underline"
      >
        <div className="relative mb-4 aspect-[4/3] overflow-hidden">
          {showPlaceholder ? (
            <div
              className="flex h-full w-full items-center justify-center bg-[#2a2a28] px-4"
              aria-hidden
            >
              <span className="text-center font-[var(--font-display)] text-sm uppercase tracking-[0.2em] text-[#e5e7d4] md:text-base">
                {category}
              </span>
            </div>
          ) : (
            <img
              src={image_url}
              alt={title}
              loading="lazy"
              decoding="async"
              onError={() => setImageError(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              className="transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>

        <div className="mb-2">
          <span className="text-primary text-[11px] font-medium uppercase tracking-widest">
            {category}
          </span>
        </div>

        <h3 className="mb-2 font-[var(--font-display)] text-xl font-extrabold uppercase leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary md:text-2xl">
          {title}
        </h3>

        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {location?.trim() ? `${displayDate} — ${location}` : displayDate}
        </p>
        {vibe_description?.trim() ? (
          <p className="mt-2 text-sm leading-snug text-muted-foreground/80 normal-case tracking-normal">
            {vibe_description}
          </p>
        ) : null}
      </a>

      <div
        role="group"
        aria-label="Vote on this event"
        data-vote-controls
        className="event-card-votes relative z-30 mt-4 flex w-full shrink-0 flex-row flex-wrap items-center gap-2 border-t border-foreground/20 pt-3"
      >
        <span className="mr-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Vote
        </span>
        <button
          type="button"
          onClick={() => handleVoteClick("up")}
          aria-label="Thumbs up"
          aria-pressed={userVote === "up"}
          className={`event-card-vote-btn inline-flex h-11 w-11 shrink-0 touch-manipulation select-none items-center justify-center rounded-full border border-foreground/30 bg-background p-0 text-foreground transition-colors ${
            userVote === "up"
              ? "border-primary bg-primary/10 text-primary"
              : !canInteractWithVote("up")
                ? "opacity-40"
                : "active:bg-foreground/10"
          }`}
        >
          <ThumbsUp className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
        <span
          className="min-w-[2ch] shrink-0 select-none tabular-nums text-base font-medium text-foreground"
          suppressHydrationWarning
        >
          {displayVotes}
        </span>
        <button
          type="button"
          onClick={() => handleVoteClick("down")}
          aria-label="Thumbs down"
          aria-pressed={userVote === "down"}
          className={`event-card-vote-btn inline-flex h-11 w-11 shrink-0 touch-manipulation select-none items-center justify-center rounded-full border border-foreground/30 bg-background p-0 text-foreground transition-colors ${
            userVote === "down"
              ? "border-primary bg-primary/10 text-primary"
              : !canInteractWithVote("down")
                ? "opacity-40"
                : "active:bg-foreground/10"
          }`}
        >
          <ThumbsDown className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
        {voteError ? (
          <span className="w-full text-[10px] uppercase tracking-wide text-primary">{voteError}</span>
        ) : null}
      </div>
    </article>
  )
}
