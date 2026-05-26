# What Should We Do — Project Notes

## Site
https://whatshouldwedo-gamma.vercel.app
Domain: whatshouldwedo.com.au

## Stack
Next.js, Tailwind, Supabase, Vercel, Cursor

## Current state
- 55 filtered events in Supabase
- Eventbrite API connected with venue/organiser whitelist
- Event cards link to original listings
- Images not loading — fix: replace Next.js Image with plain img tag
- Header sticky, nav links red
- Default filter: THIS MONTH

## Next session priorities
1. Fix event card images
2. Increase event volume to 150-200
3. Direct Supabase insert — no more CSV
4. Simple /admin review page
5. Connect whatshouldwedo.com.au domain
6. Resident Advisor as second source

## Roadmap
V2: Admin page, direct insert, RA integration
V3: AI descriptions, daily cron job, confidence scoring
V4: TikTok/Apify, Broadsheet scraping, email digest

## Key decisions
- No ads ever
- Human-in-the-loop curation
- Tagline: "again for the first time"
- Venue + organiser whitelist bypasses keyword filters