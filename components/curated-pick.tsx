export function CuratedPick() {
  return (
    <section className="py-12 md:py-16 px-4 md:px-8 lg:px-16 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-primary text-xs uppercase tracking-[0.2em] font-semibold">
            Our Pick This Week
          </span>
          <div className="flex-1 h-px bg-foreground/20" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image */}
          <div className="relative aspect-[4/3] lg:aspect-square overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=2074&auto=format&fit=crop"
              alt="Late-night DJ set at Colour Club"
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Content */}
          <div className="flex flex-col justify-center">
            <span className="text-primary text-xs uppercase tracking-[0.15em] font-medium mb-3">
              Music / Late Night
            </span>
            
            <h3 className="font-[var(--font-display)] text-3xl md:text-4xl lg:text-5xl font-black text-foreground uppercase tracking-tight leading-[0.95] mb-6">
              Colour Club: Floating Points DJ Set
            </h3>
            
            <p className="text-foreground/80 text-base md:text-lg leading-relaxed mb-6 max-w-xl">
              {"Forget the big-room festival sound. This is Floating Points in a 200-cap basement, playing records until 4am. The kind of night where you lose track of time and leave with your ears ringing in the best way. Go with someone who doesn't need to talk."}
            </p>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground uppercase tracking-wide mb-8">
              <span>Sat 24 May</span>
              <span className="w-1 h-1 bg-muted-foreground rounded-full" />
              <span>Collingwood</span>
              <span className="w-1 h-1 bg-muted-foreground rounded-full" />
              <span>$45</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 text-[10px] uppercase tracking-widest border border-foreground/30 text-foreground/70">
                Late night
              </span>
              <span className="px-3 py-1.5 text-[10px] uppercase tracking-widest border border-foreground/30 text-foreground/70">
                High energy
              </span>
              <span className="px-3 py-1.5 text-[10px] uppercase tracking-widest border border-foreground/30 text-foreground/70">
                Solo-friendly
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
