# Fix & Recheck: real-wallet browser evidence

Result: **PASS** for Chrome and MetaMask on GenLayer StudioNet (61999).
Tested revision: `1f9853c11215aaae6a2a5a2383a0a10c41af4eec`.
Started: `2026-09-08T09:28:11.315Z`. Completed: `2026-09-08T09:45:22.826Z`.

The user approved three real transactions in MetaMask on the private deployed
app. Successful execution and matching `LATEST_FINAL` records were independently
checked using the GenLayer SDK. No tokens were transferred. This report promotes
the completed test evidence into Git; it is not a new run or a claim that a
later maintenance revision was retested through wallet signing.

## Exact texts and outcomes

English: `Test announcement: the workshop starts at 10 am on 20 October 2026.`

Original French: `Annonce test : l’atelier commence à 11 h le 20 octobre 2026.`

Corrected French: `Annonce test : l’atelier commence à 10 h le 20 octobre 2026.`

| Step | Finalized result | Transaction |
| --- | --- | --- |
| Assess original | Execution succeeded; CHANGED / NUMBER_OR_DATE; policy false, MEANING_CHANGED | [Assessment](https://explorer-studio.genlayer.com/tx/0xaa920bbc0120f39f0743131a83c6c7511c122624698d91f5ce0750fd6d6f5ab9) |
| Request correction | Execution succeeded; SUGGESTED; advisory_only and requires_separate_assessment true | [Correction](https://explorer-studio.genlayer.com/tx/0x2bef560bf2c358404256e455c14e6e67c941efd65d4948a41c49c1d03ee38b4e) |
| Recheck revision | Execution succeeded; PRESERVED / NONE; policy true, no failure reasons | [Recheck](https://explorer-studio.genlayer.com/tx/0x0df9500599f60937a497c8d9ccebb2535c841a31103966d55dd670fde9114a28) |

Original assessment:
`d8c832460455662c0616186e8140fd2d232ecafaa8b5b617959059b29920e67b`.

Revised assessment:
`c6931376809f0f4042492532d98d971c6fee09ea8d7b3e1267787f5716dbd98d`.

[Open verified comparison](https://translatecheck.blazekingsley2.chatgpt.site/?assessment=c6931376809f0f4042492532d98d971c6fee09ea8d7b3e1267787f5716dbd98d&compare=d8c832460455662c0616186e8140fd2d232ecafaa8b5b617959059b29920e67b)

## What the browser and finalized reads proved

- A failed result opened Fix & Recheck with the English source and target locked.
- Unchanged revisions could not be rechecked. Existing suggestions and exact
  finalized revisions were reused without additional transactions.
- The native correction did not auto-adopt, assess, approve, or publish itself.
- Before the separate recheck, the suggested text returned ASSESSMENT_NOT_FOUND
  and `satisfied: false` from finalized checker state.
- After the recheck, the original record remained unchanged and blocked. Only
  the exact corrected text passed. Assessment count rose from 7 to 9;
  publication count remained 2.
- The comparison URL reloaded both records without a wallet connection.
- Editing the verified revision from 10 h to 12 h removed its approval,
  verified-comparison link, and Publish action. This edit was not submitted.
- Reload restored the correct 10 h revision and original failed assessment.

## Contract provenance

Checker: `0xd79Fc921D3DD42227E81e5f13311643E8720E603`.
Source SHA-256: `d1822ee1ecb294382228f3343ea39cd322e717b45d859c78ef5d9e3c0fdbc28d`.

Correction companion: `0xCE0e2EbF9CdB30145EE4badcacAecFCCc6bc593e`.
Source SHA-256: `a927245bef02f7c52c719b4be898729aed1eb94932010d28e65f32b5112b4acc`.

[Structured test record](../deployments/fix-recheck-browser-test.json)

## Boundaries

This fresh signing fixture is English to French, in Chrome with MetaMask.
It is not an accuracy benchmark or a claim about all wallets/devices. No
physical mobile wallet, actual OKX signing, or Phantom signing was tested.
The corrected translation was eligible for publication but was deliberately
not published. Earlier publication testing and automated tests are separate.

The app remains private until its owner decides to share it. The comparison
link will require authorized access until then. Publishing this evidence does
not itself change app/repository access or establish hackathon eligibility.
