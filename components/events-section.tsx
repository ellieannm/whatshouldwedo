"use client"

import { useState } from "react"
import { EventCard } from "./event-card"

const vibeFilters = [
  { label: "Late night", value: "late-night", icon: "🌙" },
  { label: "Low key", value: "low-key", icon: "🌿" },
  { label: "High energy", value: "high-energy", icon: "⚡" },
  { label: "Free or cheap", value: "free-cheap", icon: "💸" },
  { label: "Spontaneous", value: "spontaneous", icon: "🎲" },
  { label: "Solo-friendly", value: "solo", icon: "🧍" },
  { label: "Good for groups", value: "groups", icon: "👥" },
]

const timeFilters = [
  { label: "This Week", value: "week" },
  { label: "Weekend", value: "weekend" },
  { label: "This Month", value: "month" },
]

const events = [
  {
    title: "Northside Records In-Store Session",
    category: "Music",
    date: "Sat 24 May",
    location: "Fitzroy",
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=2070&auto=format&fit=crop",
    period: "weekend",
    vibes: ["low-key", "free-cheap", "solo"]
  },
  {
    title: "Queen Vic Night Market",
    category: "Markets",
    date: "Wed 28 May",
    location: "CBD",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=2074&auto=format&fit=crop",
    period: "week",
    vibes: ["groups", "free-cheap"]
  },
  {
    title: "New Acquisitions Opening Night",
    category: "Art",
    date: "Fri 30 May",
    location: "Collingwood",
    image: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?q=80&w=2044&auto=format&fit=crop",
    period: "week",
    vibes: ["low-key", "free-cheap", "solo"]
  },
  {
    title: "Raw Comedy Semi-Finals",
    category: "Comedy",
    date: "Sat 31 May",
    location: "Brunswick",
    image: "https://images.unsplash.com/photo-1585699324551-f6322a8a2c1e?q=80&w=2070&auto=format&fit=crop",
    period: "weekend",
    vibes: ["high-energy", "groups"]
  },
  {
    title: "Rooftop Cinema: Wong Kar-wai",
    category: "Film",
    date: "Sun 1 Jun",
    location: "CBD",
    image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop",
    period: "weekend",
    vibes: ["low-key", "solo", "groups"]
  },
  {
    title: "Late Night at Boney",
    category: "Late Night",
    date: "Fri 30 May",
    location: "Prahran",
    image: "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?q=80&w=2029&auto=format&fit=crop",
    period: "week",
    vibes: ["late-night", "high-energy", "groups"]
  },
  {
    title: "Brunswick Music Festival",
    category: "Music",
    date: "Sat 7 Jun",
    location: "Brunswick",
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=2070&auto=format&fit=crop",
    period: "month",
    vibes: ["high-energy", "groups", "free-cheap"]
  },
  {
    title: "Melbourne Food & Wine Festival",
    category: "Food",
    date: "Fri 13 Jun",
    location: "Various",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop",
    period: "month",
    vibes: ["groups"]
  },
  {
    title: "NGV Friday Nights",
    category: "Art",
    date: "Fri 20 Jun",
    location: "Southbank",
    image: "https://images.unsplash.com/photo-1554907984-15263bfd63bd?q=80&w=2070&auto=format&fit=crop",
    period: "month",
    vibes: ["late-night", "low-key", "solo", "free-cheap"]
  },
  {
    title: "Spontaneous Jazz at Paris Cat",
    category: "Music",
    date: "Tonight",
    location: "CBD",
    image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=2064&auto=format&fit=crop",
    period: "spontaneous",
    vibes: ["spontaneous", "late-night", "low-key", "solo"]
  },
  {
    title: "Free Yoga in the Park",
    category: "Wellness",
    date: "Tomorrow 7am",
    location: "Fitzroy Gardens",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=2120&auto=format&fit=crop",
    period: "spontaneous",
    vibes: ["spontaneous", "free-cheap", "low-key", "solo"]
  },
  {
    title: "Techno Warehouse Party",
    category: "Music",
    date: "Sat 24 May",
    location: "Footscray",
    image: "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?q=80&w=2070&auto=format&fit=crop",
    period: "weekend",
    vibes: ["late-night", "high-energy", "groups"]
  }
]

type TimeFilter = "week" | "weekend" | "month"
type VibeFilter = typeof vibeFilters[number]["value"]

export function EventsSection() {
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>("weekend")
  const [activeVibes, setActiveVibes] = useState<VibeFilter[]>([])
  
  const toggleVibe = (vibe: VibeFilter) => {
    setActiveVibes(prev => 
      prev.includes(vibe) 
        ? prev.filter(v => v !== vibe)
        : [...prev, vibe]
    )
  }
  
  const filteredEvents = events.filter(event => {
    // Time filter
    let passesTimeFilter = false
    if (activeTimeFilter === "week") {
      passesTimeFilter = event.period === "week" || event.period === "weekend" || event.period === "spontaneous"
    } else if (activeTimeFilter === "weekend") {
      passesTimeFilter = event.period === "weekend" || event.period === "spontaneous"
    } else {
      passesTimeFilter = true // month shows all
    }
    
    // Vibe filter - if any vibes selected, event must match at least one
    const passesVibeFilter = activeVibes.length === 0 || 
      activeVibes.some(vibe => event.vibes.includes(vibe))
    
    return passesTimeFilter && passesVibeFilter
  })

  return (
    <section className="py-16 md:py-24 px-4 md:px-8 lg:px-16">
      {/* Header with time filters */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
        <h2 className="font-[var(--font-display)] text-3xl md:text-4xl lg:text-5xl font-black text-foreground uppercase tracking-tight">
          {"What's On"}
        </h2>
        
        {/* Time filter tabs */}
        <div className="flex gap-2">
          {timeFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveTimeFilter(filter.value as TimeFilter)}
              className={`px-4 py-2 text-xs uppercase tracking-widest font-medium transition-colors ${
                activeTimeFilter === filter.value
                  ? "bg-primary text-[#e5e7d4]"
                  : "bg-transparent text-foreground border border-foreground hover:bg-foreground hover:text-background"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Vibe filters */}
      <div className="mb-12">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-4 font-medium">
          Filter by vibe
        </p>
        <div className="flex flex-wrap gap-2">
          {vibeFilters.map((vibe) => (
            <button
              key={vibe.value}
              onClick={() => toggleVibe(vibe.value)}
              className={`px-3 py-2 text-xs uppercase tracking-wide font-medium transition-all flex items-center gap-2 ${
                activeVibes.includes(vibe.value)
                  ? "bg-foreground text-background"
                  : "bg-transparent text-foreground border border-foreground/40 hover:border-foreground"
              }`}
            >
              <span>{vibe.icon}</span>
              <span>{vibe.label}</span>
            </button>
          ))}
          {activeVibes.length > 0 && (
            <button
              onClick={() => setActiveVibes([])}
              className="px-3 py-2 text-xs uppercase tracking-wide font-medium text-primary hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
      
      {/* Events grid */}
      {filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {filteredEvents.map((event, index) => (
            <EventCard key={index} {...event} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg mb-4">
            No events match your filters
          </p>
          <button
            onClick={() => {
              setActiveVibes([])
              setActiveTimeFilter("month")
            }}
            className="text-primary underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            Show all events
          </button>
        </div>
      )}
    </section>
  )
}
