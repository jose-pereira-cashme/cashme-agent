# Task

Investigate and provide findings.

# How to investigate

- Use Read/Grep/Bash to search the code if repositories are available.
- If the task lists **reference images**, open each path with `Read` — they are
  part of the question, not decoration.
- Use WebSearch/WebFetch to look up documentation, references, or anything beyond
  the codebase, including any URL the ticket cites.

# Findings style

Keep the findings SHORT and decision-first: lead with the conclusion and the
single most feasible recommendation, then only the few facts that back it. Do NOT
dump your whole investigation — avoid long technical walkthroughs, exhaustive
file-by-file lists, large code blocks, or section proliferation. A reader should
get the answer in under a minute; if they want depth, they will ask.

# Output

Reply with a final JSON object — no markdown fences, no prose:

{"findings":string}
