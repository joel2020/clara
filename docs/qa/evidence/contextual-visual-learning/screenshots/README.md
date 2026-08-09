# Historical Preview screenshot index

These historical captures use the earlier immutable Vercel Preview deployment at commit
`5eb2a20ab9622b36734b8e9b60fed21613070659`. They contain no learner identity,
recording, or transcript content. They do not depict the superseding pilot candidate at
commit `a6e00aec7eec5ef4966f8419a272f4016ea707fc`.

| Requested viewport | Evidence | Observed result |
| --- | --- | --- |
| 320×568 | `preview-login-320x568.jpg` | Google sign-in gate rendered without horizontal overflow; the capture tool saved the 305×541 document area inside the 320×568 viewport. |
| 390×844 | `preview-login-390x844.jpg` | Google sign-in gate rendered without horizontal overflow. |
| 768×1024 | `preview-login-768x1024.jpg` | Google sign-in gate rendered without horizontal overflow. |
| 1440×900 | `preview-login-1440x900.jpg` | Google sign-in gate rendered without horizontal overflow. |

These screenshots prove Preview reachability and responsive rendering of the authentication
gate only. They do not prove that the café lesson stages work in Preview. The automation
did not initiate Google OAuth or transmit credentials, so authenticated Preview captures
of story, discovery, speaking, feedback, and fallback states remain pending.
