# Fix & Recheck boundary

The original TranslateCheck contract remains the sole meaning-assessment and
publication authority. Its address, policy, source, records and publication gate
do not change in this release.

A separate, immutable StudioNet companion coordinates reusable correction
proposals. It reads a real original assessment from its fixed checker address,
generates a draft, and has validators independently judge that draft against the
original English source. Consensus records a linked advisory proposal, not a
publication approval. There is no publish method, callback, payment, or write to
the checker. One proposal per original assessment prevents draft rerolls.

The frontend owns the editing workspace and before/after presentation. The user
explicitly adopts or edits a suggestion, then separately requests the existing
checker's assessment of the exact revised text. Existing exact-input assessments
are reused, never overwritten. An edited draft loses any previously shown gate.
An unchanged draft cannot be represented as a new revision. Missing, ambiguous,
out-of-scope, or failed AI results never authorize publication.

Flow: finalized failed assessment → wallet-signed correction request → independently
validated advisory record → human adoption/edit → separate checker assessment →
deterministic publication gate. All text submitted for correction is public.

Original and revised assessments remain durable on GenLayer. The comparison URL
contains both IDs and can be reopened by a reviewer; both records are re-fetched
from finalized state. A temporary editing session may be stored on this device,
but that cache is never trusted as proof of an assessment or a revision link.

This native approach avoids an external AI API secret. It adds a separate wallet
request and consensus wait for a new suggestion. Manual revision remains available
if a suggestion is unavailable. It is not an autonomous publishing integration,
certified translation, or a guarantee of linguistic correctness.
