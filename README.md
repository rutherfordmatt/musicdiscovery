# Music Discovery Agent

Automated weekly music discovery for electronica, post-rock, and dance music.

## Features
- Scrapes Bandcamp for new electronic and ambient releases
- Monitors music blogs (XLR8R, Resident Advisor, The Quietus)
- AI-powered curation and filtering
- Auto-publishes to Ghost CMS
- Runs weekly via GitHub Actions

## Setup
1. Set GitHub repository secrets:
   - `ANTHROPIC_API_KEY`
   - `GHOST_ADMIN_API_KEY` 
   - `GHOST_API_URL`

2. Run manually or wait for Sunday 9 AM UTC

## Local Testing
```bash
npm install
node index.js
