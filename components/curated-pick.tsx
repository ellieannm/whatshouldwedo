export function CuratedPick() {
  return (
    <section className="py-12 md:py-16 px-4 md:px-8 lg:px-16 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-primary text-xs uppercase tracking-[0.2em] font-semibold">
            Our Pick This Week
          </span>
          <div className="flex-1 h-px bg-foreground/20" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="relative aspect-[4/3] lg:aspect-square overflow-hidden">
            <img
              src="/rising-2026.png"
              alt="RISING 2026 — 27 May to 8 June"
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex flex-col justify-center">
            <span className="text-primary text-xs uppercase tracking-[0.15em] font-medium mb-3">
              Festival / Arts
            </span>
            
            <h3 className="font-[var(--font-display)] text-3xl md:text-4xl lg:text-5xl font-black text-foreground uppercase tracking-tight leading-[0.95] mb-6">
              RISING 2026
            </h3>
            
            <p className="text-foreground/80 text-base md:text-lg leading-relaxed mb-6 max-w-xl">
              {"Melbourne's annual arts and music festival returns for two weeks of performance, installation and late nights. Over 100 events across the city — theatre, electronic music, visual art and experiences you won't find anywhere else."}
            </p>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground uppercase tracking-wide mb-8">
              <span>27 May — 8 June</span>
              <span className="w-1 h-1 bg-muted-foreground rounded-full" />
              <span>Melbourne</span>
              <span className="w-1 h-1 bg-muted-foreground rounded-full" />
              <a 
                href="https://2026.rising.melbourne/program"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:opacity-70 transition-opacity normal-case tracking-normal"
              >
                Full programme →
              </a>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 text-[10px] uppercase tracking-widest border border-foreground/30 text-foreground/70">
                Festival
              </span>
              <span className="px-3 py-1.5 text-[10px] uppercase tracking-widest border border-foreground/30 text-foreground/70">
                Late night
              </span>
              <span className="px-3 py-1.5 text-[10px] uppercase tracking-widest border border-foreground/30 text-foreground/70">
                Arts
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}