# Why New Errors Can Appear After Fixing AI Review Deductions

## Rationale

When the AI code review returns **REJECT** with deductions, fixing only the single mentioned point often leads to **new deductions** on the next run. Reasons:

1. **Related issues:** One deduction (e.g. missing input validation) is often tied to others in the same file (e.g. error handling, auth checks). Fixing one can change control flow or surface the next.
2. **Same checklist, different focus:** The reviewer uses a fixed checklist (IDOR/auth, rate limiting, input validation, error handling, edge cases). After you fix one item, the next run may highlight the next failing item in the same area.
3. **Fewer distractions:** Once one issue is fixed, the model may “see” the next violation more clearly.

So **addressing deductions narrowly** tends to cause multiple review cycles. **Doing a broad pass per affected file** over the full checklist in one go reduces re-runs and gets to ACCEPT faster.

## What to do when REJECT is returned

- Do **not** fix only the one point named in the deductions.
- For **each affected file** (inferred from the diff or the deduction reasons), run through the **full route/API checklist** below in one pass.
- Then commit and re-run the review.

## Route / API checklist (per affected file)

Use this list for every route or API handler in the files that were part of the reviewed diff:

| Area | Check |
|------|--------|
| **IDOR / Auth** | Does the handler verify the current user is allowed to access the requested resource (e.g. by ID)? No IDOR: IDs from the client are validated against the authenticated user / permissions. |
| **Rate limiting** | Is the endpoint protected by rate limiting where appropriate (auth, sensitive actions, public APIs)? |
| **Input validation** | Are all inputs (body, query, params) validated (e.g. Zod) before use? Type and format checks; reject invalid input with a clear response. |
| **Error handling** | Are errors caught and mapped to stable responses (e.g. 4xx/5xx) without leaking internals? No raw stack traces or internal messages to the client. |
| **Edge cases** | Are null/empty, missing optional fields, and boundary values handled? No unhandled edge cases that could cause 500s or wrong behavior. |

After you have gone through this checklist for all affected files, commit and run the AI review again. See **AGENTS.md** for the rule “When AI review REJECTs — address broadly”.
