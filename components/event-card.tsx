"use client"

import { useState } from "react"

interface EventCardProps {
  title: string
  category: string
  date: string
  location: string
  image_url: string
  source_url?: string
  period?: string
}

export function EventCard({
  title,
  category,
  date,
  location,
  image_url,
  source_url,
}: EventCardProps) {
  const [imageError, setImageError] = useState(false)
  const showPlaceholder = !image_url?.trim() || imageError
  const href = source_url?.trim() || "#"

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block cursor-pointer no-underline"
    >
      <article>
        <div className="relative aspect-[4/3] overflow-hidden mb-4">
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
          <span className="text-primary text-[11px] uppercase tracking-widest font-medium">
            {category}
          </span>
        </div>

        <h3 className="font-[var(--font-display)] text-xl md:text-2xl font-extrabold text-foreground mb-2 group-hover:text-primary transition-colors leading-tight uppercase">
          {title}
        </h3>

        <p className="text-muted-foreground text-xs uppercase tracking-wide">
          {date} — {location}
        </p>
      </article>
    </a>
  )
}
