# Task

Classify this issue and select the relevant repositories.

1. **Determine the type:** `implementation` (code changes), `research`
   (investigation/search), or `other` (neither).
2. **Pick every relevant repo** (for implementation or research). For
   implementation, include EACH repo the change must land in: when the catalog
   says a repo has a duplicate/sibling that shares its code (e.g. an A/B pair, or
   a client/partner portal on the same codebase), include all of them unless the
   issue explicitly names just one.
3. **Extract any user-provided prompt/instruction** from the description (text
   after an @mention/tag or an explicit directive). If none, leave it empty.

# Output

Reply with JSON:

{"taskType":"implementation"|"research"|"other","repoNames":string[],"reason":string,"userPrompt":string}

- `taskType` — `"implementation"` for code changes, `"research"` for
  investigation, `"other"` if unclear
- `repoNames` — array of repo names (one or more; include duplicate siblings for
  implementation when the catalog says so; empty if no repo needed)
- `reason` — brief explanation of the classification
- `userPrompt` — extracted instruction/question from the description (empty string
  `""` if none)
