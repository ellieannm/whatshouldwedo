export function TickerStrip() {
  const tickerText = "MUSIC. ART. FOOD. MARKETS. COMEDY. FILM. THEATRE. LATE NIGHT. ALWAYS SOMETHING. "
  
  return (
    <div className="bg-primary py-2.5 overflow-hidden border-t border-b border-[#e5e7d4]/20">
      <div className="flex animate-scroll whitespace-nowrap">
        {[...Array(6)].map((_, index) => (
          <span 
            key={index} 
            className="font-[var(--font-display)] text-sm md:text-base tracking-[0.1em] text-[#e5e7d4] uppercase font-extrabold"
          >
            {tickerText}
          </span>
        ))}
      </div>
    </div>
  )
}
