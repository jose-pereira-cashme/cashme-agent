# Task

Classify this issue and select the relevant repositories.

1. **Determine the type:** `implementation` (code changes), `research`
   (investigation/search), or `other` (neither).
2. **Pick every relevant repo** (for implementation or research), using only
   names from the catalog above — never invent one. Follow "Choosing the repo"
   below. For implementation, include EACH repo the change must land in: when
   the catalog says a repo has a duplicate/sibling that shares its code (e.g. an
   A/B pair, or a client/partner portal on the same codebase), include all of
   them unless the issue explicitly names just one. If no catalog repo can be
   identified with confidence, classify the issue as `other` and say so in
   `reason` — do not guess a repo.
3. **Extract any user-provided prompt/instruction** from the description (text
   after an @mention/tag or an explicit directive). If none, leave it empty.

# Choosing the repo

Do not decide from the described behaviour alone — several repos look alike
(institutional site vs. logged-in portal vs. simulator), and picking by topic is
the most common way this triage goes wrong. Read the WHOLE ticket for explicit
pointers to a system first, and only fall back to inferring from the described
behaviour when there are none.

Weigh, in roughly this order:

1. **The title.** Teams routinely stamp the target system there, often
   abbreviated or nicknamed rather than by repo name. Treat such a marker as a
   strong signal about where the work lands, e.g.:
   - "Portal CM", "CM", "CashMember", "portal do cliente" → `cashmember`
   - "Simulador", "Simulador 3.0", "Sim 3.0" → the simulator repos
   - "DS", "Design System" → the design system repos
   - "Site", "Institucional", "LP" → the institutional site / landing pages
   - "Secme" → `secme`
   These are examples, not an exhaustive table: any product name, acronym or
   nickname in the title that maps onto a catalog description counts the same
   way.
2. **System fields.** The ticket may carry a field such as "Sistema Cashme"
   naming the system involved (shown under "Ticket system fields" when present).
   Weigh it as strongly as a marker in the title.
3. **Explicit pointers in the description.** Repo names, GitHub URLs, branch
   names, file or component paths, package names, or the URL/domain of the
   affected page (e.g. a `/dashboard` path behind login vs. a public marketing
   page) — a concrete path or URL usually settles it.
4. **The described behaviour**, matched against the catalog descriptions. Use
   this to confirm the signals above, or on its own only when the ticket gives
   no explicit pointer at all.

None of these is a hard rule. Tickets are filled in by hand: the title marker
and the system field can be stale, generic, wrong, or contradict the body. So:

- Treat each one as strong evidence, not as a verdict, and let them accumulate.
  When the title marker, the system field and the description agree, commit to
  that repo.
- When they conflict, prefer the most specific and most concrete evidence (a
  URL, path or component the ticket actually points at) over a broad label, and
  explain the conflict in `reason`.
- A system name may map onto more than one catalog repo (a portal plus its
  module, or an A/B pair). Include every repo the change must land in.
- If, after weighing everything, no catalog repo stands out, return `other`
  rather than guessing.

# Output

Reply with JSON:

{"taskType":"implementation"|"research"|"other","repoNames":string[],"reason":string,"userPrompt":string}

- `taskType` — `"implementation"` for code changes, `"research"` for
  investigation, `"other"` if unclear or if no catalog repo matches
- `repoNames` — array of repo names (one or more; include duplicate siblings for
  implementation when the catalog says so; empty if no repo needed)
- `reason` — brief explanation of the classification. Say which evidence decided
  the repo (title marker, system field, URL/path, or catalog description), and
  note any conflict between them. For `"other"`, write it in Brazilian
  Portuguese and addressed to the ticket reporter: state what is missing or
  ambiguous in the description, since this text is posted back as a Jira comment
- `userPrompt` — extracted instruction/question from the description (empty string
  `""` if none)
