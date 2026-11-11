# mfosec.xyz

ASCII / terminal-themed site for mfosec: web3 security, web app security, cross-platform app development, and on-demand websites & apps. Static, dependency-free, deployed as a Cloudflare Workers static-assets project (`wrangler.toml`), auto-deployed from `main` via Workers Builds.

## Files

- `index.html` — markup + content (EN default; TR strings live in `assets/app.js`)
- `assets/style.css` — all styles
- `assets/ascii.js` — vanilla ports of two 21st.dev community components by @nikolas-sapa:
  *Background ASCII Plasma* (full-screen glyph field) and *Text ASCII Cascade* (hero banner)
- `assets/app.js` — i18n, ASCII part textures, terminal animation, scroll-driven MacBook teardown
- `.assetsignore` — keeps README / config out of the deployed assets

## The MacBook teardown

`#teardown` is a 560vh section with a sticky 3D stage. Scroll progress `p` (0→1) drives:
lid opens → camera swings to 3/4 view → lid lays flat → lid stacks on top and every layer separates →
labels appear. Each layer maps to a service (screen → on-demand builds, logic board → web3 security, …).
Timings are the `seg(p, a, b)` calls in `render()` in `assets/app.js`; layer gap is `g`.

## Run locally

```bash
python3 -m http.server 4321    # → http://localhost:4321
# or: npx wrangler dev
```

## Editing content

- English copy: directly in `index.html` (elements with `data-i18n`)
- Turkish copy: the `TR` object at the top of `assets/app.js`, same keys
- Language: auto-detected (`tr*` browser locale → TR), toggle in the nav, remembered in localStorage
