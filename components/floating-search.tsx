"use client"

import { Search } from "lucide-react"

export function FloatingSearchButton() {
  return (
    <button 
      className="fixed z-40 w-14 h-14 md:w-16 md:h-16 rounded-full bg-foreground/80 text-background flex items-center justify-center hover:bg-foreground transition-colors"
      style={{ 
        left: 'calc(55% - 2rem)',
        top: '50%',
        transform: 'translateY(-50%)'
      }}
      aria-label="Search events"
    >
      <Search className="w-5 h-5 md:w-6 md:h-6" />
    </button>
  )
}
