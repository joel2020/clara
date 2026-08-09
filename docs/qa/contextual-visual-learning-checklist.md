# Contextual visual learning QA checklist

Use the Preview deployment and complete every row before release. Test the entire café flow:
story → object discovery → speaking → grading/feedback. Record `Pass`, `Fail`, or `Blocked` in
Result. Evidence must be a repository-relative screenshot, video, or test note path. Link every
failure to its tracked issue; use `—` only when a passing row has no issue.

The screen-reader rows require a real assistive technology such as VoiceOver, TalkBack, NVDA, or
JAWS. Browser emulation is acceptable only for the viewport and network-condition rows.

The 2026-08-09 automated Preview session reached the real route at all four responsive
viewports but stopped at the app's Google sign-in gate. OAuth was not initiated and no
credentials were transmitted. Rows that require the lesson are recorded as `Blocked`, not
as passes; all unattempted human, real-device, and assistive-technology rows remain blank.
The superseding pilot candidate at commit `a6e00ae` independently reached the same sign-in
gate at 390×844 with an accessible DOM and no browser console warning or error. The four
committed screenshots remain explicitly historical evidence from commit `5eb2a20`.

| Check | Viewport | Tester | Device / browser / OS | Date | Result | Evidence path | Issue link |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Keyboard-only: complete story, discovery, audio retry, and speaking actions in logical order with no keyboard trap | 390×844 |  |  |  |  |  |  |
| Real screen reader: stage changes, live instructions, object names, phrase, microphone state, and feedback are announced once and in order | 390×844 |  |  |  |  |  |  |
| Real screen reader: complete the same flow with desktop navigation landmarks and headings | 1440×900 |  |  |  |  |  |  |
| Browser zoom at 200%: no clipped content or two-dimensional scrolling; phrase, microphone, and feedback remain unobscured | 1440×900 |  |  |  |  |  |  |
| Reduced motion: stage transitions, focus movement, and feedback remain understandable without required animation | 390×844 |  |  |  |  |  |  |
| Data Saver / constrained network: initial story remains usable and respects the visual asset payload budget | 390×844 |  |  |  |  |  |  |
| Image failure: environment, object, and Lumi fallbacks preserve instructions and every action | 390×844 |  |  |  |  |  |  |
| Audio failure: unavailable state and retry stay visible, operable, and correctly announced | 390×844 |  |  |  |  |  |  |
| Offline cached pack: revisit the café flow offline without a blank scene or blocked learning action | 390×844 |  |  |  |  |  |  |
| Visible keyboard focus has sufficient contrast over the mobile scene crop and never disappears behind art | 390×844 |  |  |  |  |  |  |
| Visible keyboard focus has sufficient contrast over the desktop scene crop and never disappears behind art | 1440×900 |  |  |  |  |  |  |
| Every interactive target is at least 44×44 CSS pixels, including object choices, audio retry, continue, and microphone | 320×568 |  |  |  |  |  |  |
| Small phone: story, discovery, phrase, microphone, grading feedback, and continue action remain unobscured | 320×568 | Codex automation | Chromium automation (Preview) / macOS host | 2026-08-09 | Blocked | `docs/qa/evidence/contextual-visual-learning/screenshots/preview-login-320x568.jpg` | [Preview browser gate](evidence/contextual-visual-learning/coffee-preview.md#preview-browser-gate) |
| Standard phone: story, discovery, phrase, microphone, grading feedback, and continue action remain unobscured | 390×844 | Codex automation | Chromium automation (Preview) / macOS host | 2026-08-09 | Blocked | `docs/qa/evidence/contextual-visual-learning/screenshots/preview-login-390x844.jpg` | [Preview browser gate](evidence/contextual-visual-learning/coffee-preview.md#preview-browser-gate) |
| Tablet: both orientations preserve hierarchy, readable crops, target size, phrase, microphone, and feedback | 768×1024 | Codex automation | Chromium automation (Preview) / macOS host | 2026-08-09 | Blocked | `docs/qa/evidence/contextual-visual-learning/screenshots/preview-login-768x1024.jpg` | [Preview browser gate](evidence/contextual-visual-learning/coffee-preview.md#preview-browser-gate) |
| Desktop: scene crop, Lumi, object detail, phrase, microphone, grading feedback, and continue action remain unobscured | 1440×900 | Codex automation | Chromium automation (Preview) / macOS host | 2026-08-09 | Blocked | `docs/qa/evidence/contextual-visual-learning/screenshots/preview-login-1440x900.jpg` | [Preview browser gate](evidence/contextual-visual-learning/coffee-preview.md#preview-browser-gate) |

## Release sign-off

- All rows have a named tester, device/browser/OS, ISO date, result, and evidence path.
- Every failed or blocked row has an issue link, owner, and release decision.
- Automated asset verification and the full project verification command pass on pinned Node 24.
