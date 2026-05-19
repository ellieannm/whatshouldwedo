interface EventCardProps {
  title: string
  category: string
  date: string
  location: string
  image: string
  period?: string
}

export function EventCard({ title, category, date, location, image }: EventCardProps) {
  return (
    <article className="group cursor-pointer">
      <div className="relative aspect-[4/3] overflow-hidden mb-4">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
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
