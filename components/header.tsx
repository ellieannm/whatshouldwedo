"use client"

import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useState } from "react"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between">
        {/* Logo on cream background */}
        <div className="bg-background px-4 md:px-8 py-4">
          <Link href="/" className="font-[var(--font-display)] text-primary font-black text-xl md:text-2xl tracking-tight uppercase">
            WSWD
          </Link>
        </div>
        
        {/* Navigation on the right - appears over red section on desktop */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 px-8 py-4 bg-transparent">
          <Link href="#" className="text-[10px] xl:text-xs uppercase tracking-[0.15em] text-[#e5e7d4] hover:opacity-70 transition-opacity font-medium underline underline-offset-4">
            Home
          </Link>
          <Link href="#" className="text-[10px] xl:text-xs uppercase tracking-[0.15em] text-[#e5e7d4] hover:opacity-70 transition-opacity font-medium">
            About
          </Link>
          <Link href="#" className="text-[10px] xl:text-xs uppercase tracking-[0.15em] text-[#e5e7d4] hover:opacity-70 transition-opacity font-medium">
            Events
          </Link>
          <Link href="#" className="text-[10px] xl:text-xs uppercase tracking-[0.15em] text-[#e5e7d4] hover:opacity-70 transition-opacity font-medium">
            Venues
          </Link>
          <Link href="#" className="text-[10px] xl:text-xs uppercase tracking-[0.15em] text-[#e5e7d4] hover:opacity-70 transition-opacity font-medium">
            Submit
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button 
          className="lg:hidden w-12 h-12 flex items-center justify-center text-[#e5e7d4] bg-primary mr-2"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      
      {/* Mobile Menu */}
      {isMenuOpen && (
        <nav className="lg:hidden absolute top-full left-0 right-0 bg-primary py-6 px-6">
          <div className="flex flex-col gap-5">
            <Link 
              href="#" 
              className="text-sm uppercase tracking-[0.15em] text-[#e5e7d4] font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link 
              href="#" 
              className="text-sm uppercase tracking-[0.15em] text-[#e5e7d4] font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link 
              href="#" 
              className="text-sm uppercase tracking-[0.15em] text-[#e5e7d4] font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Events
            </Link>
            <Link 
              href="#" 
              className="text-sm uppercase tracking-[0.15em] text-[#e5e7d4] font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Venues
            </Link>
            <Link 
              href="#" 
              className="text-sm uppercase tracking-[0.15em] text-[#e5e7d4] font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Submit Event
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
