# Brand

- **Logo:** designed in Canva on 2026-09-23. Editable design: https://canva.link/rlz122t2vc6ro8x
  (design `DAHWB97uIeU`). A brass "L" with a rising stroke, next to a navy serif "Launchpad" wordmark.
- **Colorway:** Ink & Brass, the recommendation from the colorways mock. Joshua hasn't formally
  picked a colorway yet. If he picks another, only the brass and navy values below change.
  - Ink `#22334a` · Brass `#a8894f` · Ivory `#f5efe1` · Dark ground `#111317`
- **Mark as code:** `public/icon.svg` is a vector redraw of Canva's mark, in flat brass without
  the export's gradient, so it stays crisp at every size. `src/components/layout/BrandMark.tsx`
  is the same shape for the sidebar and top bar.
- **Rendered sizes** in `public/`:

  | File | Use |
  | --- | --- |
  | `favicon-32.png` | Favicon |
  | `logo-120.png` | Google OAuth consent-screen logo |
  | `apple-touch-icon.png` | iPhone home screen (180) |
  | `icon-192.png`, `icon-512.png` | Install icons in `manifest.webmanifest` |

- **Re-rendering:** the PNGs come from `public/icon.svg` via headless Chromium. Any SVG-to-PNG
  tool at the listed sizes works.
