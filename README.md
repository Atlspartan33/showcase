# Showcase — terrellmasseysr.com

Personal portfolio of everything built with Claude. Static site, no build step.

- Run locally: dev server `showcase` (port 5242) — `python -m http.server 5242`
- Edit projects: `projects.js` (one entry per project; the page renders from it)
- Images: `img/<id>.webp` (≤1400px wide). Videos: `video/<id>.mp4` (720p, CRF 27, faststart)

## Status meanings
- `live` — public link, "Open it" + QR code
- `lab` — built, not public; shows "Ask for a demo"
- `family` — live but the link stays private (kids' voices/photos)

## Privacy rules
- No real photos or video of Tori or TJ. Illustrated book art is OK.
- Never link anything containing family recordings (Greyhound Getaway is `family`).
- Never list: Tend, Same Page, SOURCE CODE, Museum, genealogy, kids' learning/IEP tracker, Kim's projects, job hunts.

## Publish (not done yet — needs Terrell's go-ahead)
1. Push to a public GitHub repo `Atlspartan33/showcase`, enable Pages from `main` / root.
2. Buy the domain (Terrell does this — registrar checkout).
3. Add a `CNAME` file containing the domain, and the registrar DNS records GitHub Pages lists.
