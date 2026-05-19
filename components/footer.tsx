import Link from "next/link"
import { Instagram } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-12 md:py-16 px-4 md:px-8 lg:px-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
        <div>
          <h3 className="font-[var(--font-display)] text-2xl font-black text-primary mb-4 uppercase">
            What Should We Do?
          </h3>
          <p className="text-sm text-background/70 leading-relaxed max-w-xs">
            {"Melbourne's guide to spontaneous discovery."}
          </p>
        </div>
        
        <div>
          <h4 className="text-xs uppercase tracking-widest font-semibold mb-4">Explore</h4>
          <ul className="space-y-3 text-sm text-background/70">
            <li><Link href="#" className="hover:text-primary transition-colors">All Events</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">This Weekend</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Free Events</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Venues</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-xs uppercase tracking-widest font-semibold mb-4">Categories</h4>
          <ul className="space-y-3 text-sm text-background/70">
            <li><Link href="#" className="hover:text-primary transition-colors">Music</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Art</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Food</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Late Night</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-xs uppercase tracking-widest font-semibold mb-4">Connect</h4>
          <div className="flex gap-4 mb-6">
            <a href="#" className="w-9 h-9 border border-background/30 flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
              <Instagram className="w-4 h-4" />
              <span className="sr-only">Instagram</span>
            </a>
          </div>
          <Link 
            href="#" 
            className="inline-block border border-primary text-primary px-6 py-3 text-xs uppercase tracking-widest font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Submit Event
          </Link>
        </div>
      </div>
      
      <div className="pt-8 border-t border-background/20 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-background/50">
        <p>&copy; 2026 What Should We Do? All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="#" className="hover:text-primary transition-colors">Privacy</Link>
          <Link href="#" className="hover:text-primary transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  )
}
