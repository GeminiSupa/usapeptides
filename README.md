# USA Peptides

A research peptide storefront and laboratory reference platform built with **Next.js 14 App Router**, **TypeScript**, and **Tailwind CSS**.

## Design system

The UI runs on a small set of tokens and primitives rather than ad-hoc utility soup:

- **Palette** — near-black ground, neutral greys, a single red accent (`brand.accent`) reserved for actions, and a steel blue for links and confirmations. The stock `cyan`/`blue`/`emerald`/`gray` ramps are remapped in `tailwind.config.ts` so existing markup resolves into this palette.
- **Type** — Archivo (display/headings, 800 weight, uppercase, tight tracking) over Manrope (body) on a 14px root.
- **Surfaces** — flat. No gradients, no glows, no drop shadows; hairline borders and near-square corners instead.
- **Primitives** — `.shell`, `.eyebrow`, `.page-title`, `.section-title`, `.btn-primary`, `.btn-ghost`, `.surface`, `.rail` (defined in `src/app/globals.css`).

## Features

- **Product catalogue** — 20 compounds across incretins, GHRH/GHRP, ECM repair, melanocortins, neuropeptides, mitochondrial/longevity and lab supplies. Cards show price ranges derived from bulk tiers.
- **Certificate of Analysis viewer** — modal with a rendered chromatogram and mass-spec summary per product.
- **Reconstitution calculator** — U-100 syringe visualisation converting mg / mL / mcg to unit marks.
- **Tiered volume pricing** — 10% off 3–4, 15% off 5–9, 20% off 10+, applied automatically in cart.
- **Cart & checkout** — slide-out drawer, free-shipping threshold meter, coupon codes, multi-step checkout.

## Product artwork

Vial images in `public/vials/` are generated SVGs (see the generator note below), not photography. They are original, brand-neutral placeholders — replace them with real product shots before launch.

## Getting started

```bash
npm install     # install dependencies
npm run dev     # development server
npm run build   # static export to ./out
```

Deployment is a static export (`output: 'export'` in `next.config.mjs`) served from `out/`.
