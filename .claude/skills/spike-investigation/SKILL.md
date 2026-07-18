---
name: spike-investigation
description: Use when investigating a spike or discovery ticket about existing code — a removed/renamed page, a routing or redirect change, a refactor, or "is it feasible to bring X back". Guides a thorough investigation (current state, git history, linked docs) before concluding, so findings distinguish a trivial change from a rebuild-from-scratch.
---

# Investigating a spike / discovery ticket

A spike asks "how, and how hard" — not "make the change". Your deliverable is an
evidence-backed assessment, not code. Investigate before concluding.

## Steps

1. **Map the current state.** Use Grep/Glob/Read to find what exists *now*: the
   routes, components, config (`next.config.js` redirects/rewrites), navigation
   links, and SEO/sitemap references relevant to the ticket. Quote exact file
   paths and line numbers.

2. **Check git history — do not assume a file "doesn't exist".** If the ticket
   is about something that used to exist (a deleted page, a moved component),
   the code may only be recoverable from history. The repo is a full checkout,
   so use it:
   ```bash
   git -C <repo-path> log --oneline --all -- <path/that/may/be/gone>
   git -C <repo-path> log --oneline --all -S "<string that was in the old code>"
   git -C <repo-path> show <commit>^:<old/path>   # recover the old file contents
   ```
   Report *when* and *in which commit* something was removed or changed, and
   whether the old code/copy can be recovered.

3. **Use the linked documentation already provided.** You do NOT fetch docs
   yourself — any Confluence pages linked from the ticket have already been
   retrieved and are included in your prompt under a "Linked documentation"
   section. For a spike, the real requirements usually live there, not in the
   terse ticket description, so read that section carefully and base your
   assessment on it. If no such section is present, say the linked docs were
   unavailable rather than guessing at the requirements.

4. **Distinguish the two cases explicitly:**
   - **Trivial change** — the thing still exists and only needs a config/flag
     flip (e.g. removing a redirect entry). State the exact edit.
   - **Rebuild** — the thing was removed and the source is gone from `HEAD`.
     Then the effort is recreating it (route, view, SEO, navigation), and you
     must say what's *missing* (design, copy, assets) and who needs to provide
     it. Never call a rebuild "trivial" just because one config line is involved.

## Output — short and decision-first

The investigation above is your *work*, not your *report*. Do NOT reproduce it
step by step. The reader is a PM or lead who wants the answer fast, not a
technical walkthrough.

- **Open with a one-line verdict**: is it feasible, and what is the single
  recommended path (trivial change vs. rebuild). This is the most important line.
- **Recommend ONE approach** — the most feasible one. Only mention an alternative
  if it materially changes the decision, and then in a single line. Do not lay
  out every option you considered.
- **Keep it to a few short paragraphs or a tight bullet list.** No section
  proliferation, no long code blocks, no file-by-file inventory. Cite at most the
  one or two files/commits that actually back the decision.
- **Blockers in one short list**: what's missing (design, copy, assets) and who
  needs to provide it — that's what unblocks the next step.
- Skip implementation minutiae and technical detail unless a specific fact
  changes the estimate. If the reader wants depth, they'll ask.
- Write the findings in **Brazilian Portuguese** (this goes back to a Jira
  ticket). Aim for something readable in under a minute.
