# mfosec.xyz

Watch Dogs 2 / DEDSEC themed offensive-security portfolio. Single-page static HTML, video background, deployed on Cloudflare Pages.

## Files

- `index.html` — entire site (HTML + CSS + JS inline)
- `wd2-bg.mp4` — background video (Watch Dogs 2 main menu loop, ~28MB)
- `_archive_astro/` — old Astro+Tailwind setup, kept locally for reference (gitignored)
- `_archive_assets/` — Watch Dogs 2 reference wallpapers (gitignored)

## Run locally

```bash
# Any static server works. Simplest:
python3 -m http.server 4321
# → open http://localhost:4321
```

Opening `index.html` directly via `file://` also works but the YouTube iframe fallback may need a real origin.

## Deploy (GitHub + Cloudflare Pages)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "init: mfosec.xyz portfolio"
git branch -M main
git remote add origin git@github.com:mfosec/mfosec.xyz.git
git push -u origin main
```

### 2. Move DNS to Cloudflare

1. Sign up / log in at https://dash.cloudflare.com → **Add a Site** → enter `mfosec.xyz` → choose **Free** plan.
2. Cloudflare gives you two nameservers (e.g. `xxx.ns.cloudflare.com` / `yyy.ns.cloudflare.com`).
3. In Hostinger → Domain → `mfosec.xyz` → **DNS / Nameservers** → **Change nameservers** → paste both Cloudflare nameservers → save.
4. Propagation takes 1–24 hours. Cloudflare will email when it's active.

### 3. Connect Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → choose `mfosec.xyz` repo.
2. Build configuration:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/`
3. **Save and Deploy**.
4. After first deploy succeeds: project → **Custom domains** → **Set up a custom domain** → `mfosec.xyz` (and optionally `www.mfosec.xyz`). Cloudflare wires the DNS records automatically since the domain is on the same account.

Every push to `main` triggers a redeploy.

## Editing content

All copy lives inline in `index.html`. Search for the section comments:

- `<!-- HERO -->` — hero panel + tagline
- `<!-- ABOUT -->` — bio + tags + stats card
- `<!-- EXPERTISE -->` — web3 / web2 / arsenal grid
- `<!-- FINDINGS -->` — bounty findings list
- `<!-- PROJECTS -->` — repos grid
- `<!-- CONTACT -->` — contact card

The `art` array in the hero ASCII script defines the fox mask + MFOSEC block letters.

## Notes

- The site uses `<video>` for the local `wd2-bg.mp4`; if that fails to load it falls back to a YouTube iframe (video id `okGPcoToS3Y`). The mute button in the nav controls whichever source is active.
- Background autoplays muted (browser autoplay policy). Click the speaker icon in the nav to unmute.
