# TranslateCheck consensus boundary

English source + proposed French, Spanish, or Mandarin Chinese (Simplified) text
→ immutable UTF-8 content commitment → independent semantic reviews → consensus
on verdict and primary reason → immutable assessment → deterministic publication gate.

The app owns input editing, wallet discovery, transaction tracking, and public
history. Examples are explicitly illustrative, never fabricated chain results.
Only GenLayer can create an authoritative assessment. There is no off-chain LLM
endpoint, hidden API key, web scraping, or frontend-generated approval.

Each validator independently reviews the same stored input under policy v1.
Consensus requires exact agreement on the three-way verdict and primary reason.
Quotes must be literal substrings of the supplied texts. Explanatory prose is the
leader's explanation, not a claim that validators produced identical wording.
Malformed outputs and model exceptions cause disagreement, not an approval.

`evaluate_policy_view` is deterministic. `publish` re-evaluates the same gate in
the contract before creating a caller-bound publication record. Changed text,
changed target language, missing assessments, changed meaning, and uncertainty
all fail closed. Assessments cannot be overwritten or rerolled for identical
content. Anyone may reuse an existing assessment to publish their own exact copy.

This gate controls the TranslateCheck publication registry, not arbitrary external
websites. A publishing agent must use this contract or honor its deterministic
read; the app cannot prevent someone publishing elsewhere. There is no escrow,
token movement, reputation score, certification, or guarantee of translation quality.

Assessments are permanent snapshots of exact inputs and policy v1, not expiring
identity credentials. Timestamps are display metadata, not an expiry policy.
Source and translation are public. Human review is still needed for specialized,
ambiguous, legal, medical, or safety-critical material. StudioNet is a development
network and is not a production availability guarantee.

The UI is a static React/Vite client. The scaffold's Windows Worker runtime failed
to start; static delivery avoids an unnecessary server. Durable records live on
GenLayer, never in localStorage. Browser storage is only for pending-transaction
recovery, not a source of assessment truth.
