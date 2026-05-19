"use client"

import { useState } from "react"

interface EventCardProps {
  title: string
  category: string
  date: string
  location: string
  image: string
  period?: string
}

export function EventCard({ title, category, date, location, image }: EventCardProps) {
  const [imageError, setImageError] = useState(false)
  const showPlaceholder = !image?.trim() || imageError

  return (
    <article className="group cursor-pointer">
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
            src={image}
            alt={title}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
  )
}
