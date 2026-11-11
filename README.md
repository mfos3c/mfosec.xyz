# mfosec.xyz

Site for mfosec (dark, Geist type, lime accent, ASCII details): web3 security, web app security, cross-platform app development, and on-demand websites & apps. Static, dependency-free, deployed as a Cloudflare Workers static-assets project (`wrangler.toml`), auto-deployed from `main` via Workers Builds.

## Files

- `index.html` — markup + English copy (elements with `data-i18n`)
- `assets/i18n-tr.js` — Turkish copy, same keys
- `assets/style.css` — all styles
- `assets/ascii.js` — vanilla ports of two 21st.dev community components by @nikolas-sapa:
  *Background ASCII Plasma* (hero glyph field, rendered in a WebGL fragment shader) and
  *Text ASCII Cascade* (footer wordmark)
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
- Turkish copy: `assets/i18n-tr.js`, same keys
- Language: auto-detected (`tr*` browser locale → TR), toggle in the nav, remembered in localStorage
