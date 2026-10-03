# USA Peptide Depot — logo files

Supplied by the owner on 2026-10-02. These are the brand source files, kept here
as the master copies. Anything the site actually serves lives in `public/` and
should be exported from these.

All the artwork is one lockup: the **UPD** monogram, **USA Peptide Depot** set
beside it, and the tagline **LIMITLESS POTENTIAL** underneath. The tagline is
new — the logo currently on the site does not have it.

## svg/ — true vector, use these

Five colourways of the same drawing, `viewBox="0 0 1745 593"`, 35 paths, one
fill colour each. Scales to any size.

| File | Fill | Matches |
|---|---|---|
| `Logo green 2.svg` | `#1f4233` | brand Forest |
| `Logo  navy 2.svg` (two spaces) | `#233049` | brand Navy |
| `Logo Cream 2.svg` | `#fdfbf0` | brand Cream |
| `Logo Black 2.svg` | `#0f0f0f` | — |
| `Logo White 2.svg` | `#fff` | — |

Green, navy and cream are exactly the brandkit colours, so a colourway can be
dropped in without recolouring.

## Png/ — raster

Transparent wordmarks, 622 × 205 (same shape as the current `public/logo.png`):

- `Logo UPD green 2.png`, `Logo UPD navy 2.png`, `Logo UPD black 2.png`,
  `Logo cream 2.png`, `Logo white 2.png`

Square 1080 × 1080, opaque — social avatars and share images:

- `1,1.png` — forest logo on cream
- `2,1.png` — cream logo on forest
- `3,1.png` — cream logo on navy

Square 1080 × 1080 tiling patterns — repeated UPD monogram, low contrast,
meant as a background texture, not as a logo:

- `01.png` — pale green on cream
- `02.png` — on forest

## Ai/

`Logo Black 2.ai` — the Illustrator original, 241 KB. Editing source only;
nothing in the app reads it.

## Note on the logo the site serves today

`public/logo.svg` is not vector art. It is a base64 JPEG wrapped in an `<svg>`
and recoloured to cream with an `feColorMatrix` filter. Nothing in `src/`
references it; the app uses `public/logo.png` everywhere. The files in `svg/`
here are real vector and can replace both.
