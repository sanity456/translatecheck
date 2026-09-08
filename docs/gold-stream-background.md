# Dark-gold stream background

UI-only update, 2026-09-08. The white canvas is replaced by a dark bronze/gold
texture, with a slow drifting current. Royal-blue navigation, warm-gold accents,
and near-black panels with light text remain readable against opaque backplates.
Wallet logic, contracts, network, and assessment/publication policies are unchanged.

## Asset provenance

- Method: built-in ImageGen, one generation; no CLI fallback or external image URL.
- Integrated asset: `public/textures/gold-stream.png`.
- Original and integrated size: 1536 × 1024 PNG, 2,945,946 bytes, copied unchanged.
- SHA-256: `5d5922f33b5afcce6daed5485a6eabc4ee25491c1d616956d6cf9457995cd68f`.
- The generated asset was visually inspected before integration. This is not a
  screenshot or a browser verification of the app.

### Final prompt

> Use case: stylized-concept. Asset type: full-page website background texture, landscape 1536x1024. Create a dark antique-gold background with fine metallic glitter following the shape of a flowing stream. Broad, softly winding currents and delicate liquid-gold filaments drift through deep bronze and near-black gold. Tiny warm-gold flecks catch the light, with restrained highlights and generous darker areas so interface panels and text can sit over it. Elegant, tactile, softly luminous; fine-grained shimmer, not confetti. Edge-to-edge abstract texture, no horizon or scene. Palette: dark bronze, antique gold, near-black, warm golden highlights. No white background, no text, no letters, no logos, no watermark, no objects, no mockup or interface. This is a background asset only, not a screenshot.

## Motion and accessibility

- A single decorative layer moves over a 24-second cycle; there are no flashing
  particles, videos, or pointer-following effects.
- The footer's native button pauses and resumes the background. It does not send
  wallet requests, modify text, or write persistent state.
- `prefers-reduced-motion: reduce` disables animation, including pseudo-elements.
- Forced-colors mode hides the texture and motion control.
- The decorative layer is hidden from assistive technology and cannot intercept
  pointer events. Opaque panels separate text from the varying image highlights.

## Verification scope

Three new isolated regressions cover the actual pause/resume handler, native
button/decoration markup, and shipped PNG plus motion/accessibility CSS guards.
They do not simulate a browser, verify real mobile rendering, or repeat wallet
signing. The existing wallet evidence remains pinned to its original revision.
See `VALIDATION.md` and the CI run for the submitted revision for release checks.
