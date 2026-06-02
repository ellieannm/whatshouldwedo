"use client"

import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useState } from "react"

const navLinkClass =
  "text-[10px] xl:text-xs uppercase tracking-[0.15em] text-primary hover:opacity-70 transition-opacity font-medium"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] w-full bg-background">
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        <Link
          href="/"
          className="font-[var(--font-display)] text-primary font-black text-xl md:text-2xl tracking-tight uppercase"
        >
          WSWD
        </Link>

        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          <Link href="#" className={`${navLinkClass} underline underline-offset-4`}>
            Home
          </Link>
          <Link href="#" className={navLinkClass}>
            About
          </Link>
          <Link href="#" className={navLinkClass}>
            Events
          </Link>
          <Link href="#" className={navLinkClass}>
            Venues
          </Link>
          <Link href="/submit" className={navLinkClass}>
            Submit
          </Link>
        </nav>

        <button
          type="button"
          className="lg:hidden flex h-10 w-10 items-center justify-center text-primary"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isMenuOpen && (
        <nav className="lg:hidden border-t border-foreground/10 bg-background px-6 py-6">
          <div className="flex flex-col gap-5">
            <Link
              href="/submit"
              className="text-sm uppercase tracking-[0.15em] text-primary font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="#"
              className="text-sm uppercase tracking-[0.15em] text-primary font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link
              href="#"
              className="text-sm uppercase tracking-[0.15em] text-primary font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Events
            </Link>
            <Link
              href="#"
              className="text-sm uppercase tracking-[0.15em] text-primary font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Venues
            </Link>
            <Link
              href="#"
              className="text-sm uppercase tracking-[0.15em] text-primary font-medium"
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
