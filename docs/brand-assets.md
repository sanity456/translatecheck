# TranslateCheck owl identity

Created 2026-09-08 with built-in ImageGen: one call per asset in a parallel batch,
no retries, CLI fallback, or post-generation edits. Both outputs were visually
inspected and copied unchanged into this project with their original alpha.

## Saved assets

- `public/brand/translatecheck-logo.png`: 1254 × 1254 RGBA PNG, 823,454 bytes.
  SHA-256: `5f6909deb25100a75d3d58f985efa461893e009e498509b2fbcd340daf93fdb9`.
- `public/brand/translatecheck-mascot.png`: 1254 × 1254 RGBA PNG, 1,064,823 bytes.
  SHA-256: `d3b3afb46d9fb0e4c6721b6b3eb750cd77f4b32b240da5dcf71627d10f51346b`.

The tool returned 1254-pixel squares despite the 1024-pixel prompts. The logo has
slight tonal shading and blue details in both pupils; the mascot has tighter
vertical padding. The generated transparent edges, including faint low-alpha
specks, are retained. The designs were accepted as a related logo/character pair,
not as pixel-identical variants. This is generated artwork, not a claim of
trademark clearance or exclusive rights.

## Integration

The head emblem replaces the generic language icon in the header and is also
the browser favicon. The wordmark stays real HTML text, so image loading cannot
remove the app name. The decorative logo has empty alt text next to that name.
The full-body mascot has a descriptive alt label, reserved dimensions, and a
smaller mobile size. It appears only beside the introduction: no new button,
chatbot, animation, status badge, or approval behavior was introduced.

Two isolated tests check actual component markup and PNG dimensions/alpha support.
The full lint command retains its scope; native image exceptions are documented
at the two image elements because this is a static Vite app without the Next.js
optimizer service. Browser rendering and mobile wallet signing were not retested.

## Final logo prompt

```text
Use case: logo-brand
Asset type: final TranslateCheck owl head emblem for a website header and favicon.
Primary request: Create one original compact, friendly but sophisticated owl HEAD emblem, with a distinctive asymmetric warm-gold brow/check silhouette. This is the flat logo member of a gold and near-black owl brand family.
Scene/backdrop: Genuinely transparent background with actual alpha, clean PNG cutout. No background color, checkerboard, surface, cast shadow, or scene.
Subject: A single bold simplified owl head with two broad circular eyes, short triangular beak, geometric feather forms, and a subtle checkmark-shaped brow or wing-like facial silhouette integrated into the head. Broad warm gold #f2bd50 outer silhouette, near-black #101218 inner face, soft ivory eye details, and one very small royal-blue #2349eb accent. The asymmetric brow is its signature.
Style/medium: Crisp flat vector-like raster artwork, extremely simple and scalable, broad strong shapes and balanced negative space. Friendly attentive expression with sophisticated visual restraint.
Composition/framing: Square 1024x1024 PNG. One centered emblem fills approximately 80% of the canvas with clear edge padding. The silhouette and eyes must remain readable at 48 pixels and favicon scale.
Constraints: Original design. Only the owl head. No text, letters, wordmark, badge, label, enclosing circle, accompanying objects, microdetails, shadows, 3D, gradients, glitter, UI screenshot, or watermark. No green, no Duolingo character likeness, no graduation cap, no robot headphones. Preserve genuine transparency.
```

## Final mascot prompt

```text
Use case: stylized-concept
Asset type: final TranslateCheck owl mascot cutout displayed 88–112 pixels tall beside an app introduction on a dark-gold background.
Primary request: Create one original compact, friendly but sophisticated full-body standing owl mascot in the gold and near-black TranslateCheck brand family, with a distinctive asymmetric warm-gold brow/check silhouette, two broad circular eyes, short triangular beak, and geometric feather shapes.
Scene/backdrop: Genuinely transparent background with actual alpha, clean PNG cutout. No background color, checkerboard, ground, surface, cast shadow, or scene.
Subject: Full-body owl with warm antique gold wings and warm gold #f2bd50 facial silhouette, a near-black #101218 inner face and body, soft ivory expressive eyes, and a restrained royal-blue #2349eb neck ribbon as the only small blue accent. Chest feathers subtly form a checkmark as part of the character itself, never a floating badge. The asymmetric warm-gold brow is the face's signature.
Pose/expression: Friendly attentive head tilt, standing with both feet visible and one wing gently open as if welcoming.
Style/medium: Sophisticated soft 3D enamel-toy shading, broad clean geometric feather forms, polished gentle highlights, uncluttered silhouette. Friendly and distinctive, with enough simplicity to read at small website scale.
Composition/framing: Square 1024x1024 PNG. Centered single character, full body and feet visible, approximately 10% clear edge padding, subject fills about 80% of the canvas. No cropping.
Constraints: Original artwork. No readable text, writing, props, floating badge, glitter, UI screenshot, watermark, backdrop, or cast shadow. No green, no Duolingo character likeness, no graduation cap, no robot headphones, and no busy or photorealistic feathers. Preserve genuine transparency.
```
