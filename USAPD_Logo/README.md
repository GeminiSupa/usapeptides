# USA Peptide Depot — logo files

Brand source files, supplied by the owner on 2026-10-02. These are the masters.
Anything the site serves lives in `public/` and should be exported from here.

Everything is one lockup: the **UPD** monogram, **USA Peptide Depot** beside it,
and the tagline **LIMITLESS POTENTIAL** underneath. The tagline is new — the
logo on the site today does not have it.

The files were renamed from what the designer sent (`1,1.png`, `Logo  navy
2.svg` and so on). Every colour below was read back out of the file itself, not
taken from the old name.

## Naming

`upd-<kind>-<colour>.<ext>`, lower case, hyphens only — safe in a URL, safe in
a shell, sorts sensibly. `-on-<colour>` means that colour is the **background**.

## svg/ — true vector, prefer these

One drawing, five colourways. `viewBox="0 0 1745 593"`, 35 paths, single fill.
Scales to any size.

| File | Fill | Brand colour |
|---|---|---|
| `upd-logo-forest.svg` | `#1f4233` | Forest |
| `upd-logo-navy.svg` | `#233049` | Navy |
| `upd-logo-cream.svg` | `#fdfbf0` | Cream |
| `upd-logo-black.svg` | `#0f0f0f` | — |
| `upd-logo-white.svg` | `#fff` | — |

Forest, navy and cream are exactly the brandkit values, so a colourway drops in
without recolouring.

## png/ — raster

**Wordmarks, 622 × 205, transparent** — same shape as the current
`public/logo.png`, so they are drop-in replacements:

`upd-logo-forest.png` · `upd-logo-navy.png` · `upd-logo-cream.png` ·
`upd-logo-black.png` · `upd-logo-white.png`

Ink colours match the SVGs, with one exception: the PNG black is pure `#000000`
where the SVG black is `#0f0f0f`.

**Square 1080 × 1080, opaque** — social avatars and share images:

| File | Background | Logo |
|---|---|---|
| `upd-social-on-cream.png` | Cream `#fdfbf0` | Forest |
| `upd-social-on-forest.png` | Forest `#1f4233` | Cream |
| `upd-social-on-navy.png` | Navy `#233049` | Cream |

**Square 1080 × 1080 tiling patterns** — the UPD monogram repeated at low
contrast. These are a background texture, not a logo; do not use one where a
logo belongs:

| File | Background | Monogram |
|---|---|---|
| `upd-pattern-on-cream.png` | Cream `#fdfbf0` | `#e5e7db` pale sage |
| `upd-pattern-on-forest.png` | Forest `#1f4233` | `#385648` lighter forest |

## ai/

`upd-logo.ai` — the Illustrator original, 241 KB. Editing source only; nothing
in the app reads it.

## The logo the site serves today

`public/logo.svg` is not vector art. It is a base64 JPEG wrapped in an `<svg>`
and tinted cream with an `feColorMatrix` filter, so it softens when scaled up.
Nothing in `src/` references it — the app points at `public/logo.png`
everywhere. The files in `svg/` are real paths in the brand colours and can
replace both.
