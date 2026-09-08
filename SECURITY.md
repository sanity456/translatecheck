# Security boundary

- Only GenLayer consensus creates authoritative assessments; errors fail closed.
- Model inputs are untrusted evidence. Prompt instructions are not a complete
  defense against adversarial inputs or shared model biases.
- Evidence quotes must appear verbatim. Consensus is on verdict/reason, not
  identical explanatory prose. There is no calibrated confidence percentage.
- Identical content cannot be reassessed to shop for a verdict. There is no
  application-level appeal/correction feature in this release. Changing the
  policy requires a new deployment.
- All text is public. There is no encrypted storage, token custody, payment,
  identity certification, or legal assurance.
- Publication is an entry in this contract's registry, not enforced publication
  on other websites. A wallet address is not a verified legal identity.
- Browser storage holds already-submitted transaction recovery data and the last
  stopped transaction hash. Stopping local tracking does not cancel a transaction
  or prove failure. Only matching finalized state can restore a result; RPC errors
  and timeouts remain unknown. Chain state remains authoritative. Finalized status
  alone is not execution success.
- StudioNet is development infrastructure, not a production availability promise.
- Review the matching source, dependencies, Linux/Windows CI, and real-wallet
  browser tests before public promotion or hackathon submission.
