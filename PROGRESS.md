# WSWD Progress Log

## Current state
- Eventbrite API pulling ~212 events with filters
- Urban List scraper working (2 articles)
- Broadsheet scraper working
- GitHub Actions auto-fetch every Monday & Thursday 9am Melbourne time
- Vibe filters working (text[] array): late-night, low-key, high-energy, free-cheap, solo-friendly, groups, date-night
- Date filters: Today, This Week, Weekend, This Month, Pick a Date
- Search working (title, venue, suburb, description)
- Rising Festival curated pick (set via admin)
- Thumbs up/down voting (needs toggle fix + mobile fix)
- AI vibe one-liners via Groq (generating and caching in Supabase)
- /admin page: approve/reject/set curated pick/edit vibes inline
- /submit form: public event submission → pending in admin
- /submit/success thank you page
- RLS policies fixed, all columns in place

## Known issues to fix next session
- Thumbs up/down: can't undo vote, slow/glitchy, not showing on mobile
- Admin reject/approve not always saving to Supabase
- Some excluded keywords still slipping through (school, church, kids etc)

## Next priorities
1. Fix thumbs up/down (toggle, speed, mobile)
2. Fix admin approve/reject saving
3. Fix keyword exclusions + re-run fetch-events.js
4. AI event parser — paste text or upload image (Instagram flyers, Tori Bravo Substack)
5. ManyChat Instagram DM automation → webhook → pending event
6. Apify TikTok scraper
7. Connect whatshouldwedo.com.au domain
8. Email signup for weekly newsletter

## Key decisions
- No ads ever
- Vibes stored as text[] array
- Source names: "Eventbrite", "Urban List", "Broadsheet", "Submitted"
- Tagline: "again for the first time"
- Tone of voice: friend who actually goes out, direct, specific, slightly irreverent
- Groq (free) for AI one-liners, not Anthropic