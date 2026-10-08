---
name: confirm-my-goal
description: Plays back the user's goal, the problem behind it, and the scope in its own words, flags assumptions and open questions, then waits for confirmation before doing any work. Use when the user runs /confirm-my-goal, before starting a task where a misread would be costly.
disable-model-invocation: true
---

# Confirm My Goal

Before doing the work, show the user what you think they asked for so they can catch a misread while it is still cheap to fix. Then stop until they confirm or correct you.

The request to play back is the text passed with the command. If nothing was passed, it is the user's most recent request in the conversation.

## Workflow

1. **Gather context, read-only.** Read the request, any files or selection it points to, and whatever else you need to understand it. Do not edit files, run commands with side effects, or start the work itself.

2. **State it in your own words.** Rephrasing, not quoting, is what proves you understood. Echoing the user's words back confirms nothing.
   - **Goal**: the outcome they want and, if you can tell, why it matters to them.
   - **Problem**: the pain or gap behind the request, which is often not the same as the thing they asked for.
   - **Scope**: what you take to be in and out, when the boundary is not obvious.

3. **Surface what you filled in.** List each assumption you made and each ambiguity you resolved by guessing. Anything you inferred rather than read belongs here, including the "why" from step 2.

4. **Ask only what blocks you.** Keep open questions to the few whose answer would change what you do, most important first. Phrase each so it can be answered in a word or a line, and offer your default where you have one.

5. **Stop.** End with a direct request to confirm or correct. Do not begin the work in the same turn.

6. **On reply:**
   - Confirmed: proceed.
   - Small correction: acknowledge it in a line and proceed.
   - Correction that changes the goal or the scope: play back the revised understanding once more and wait again.

## Format

A few lines, not an essay. Omit any line that has nothing in it.

> **Goal:** <one or two sentences>
> **Problem:** <one or two sentences>
> **Scope:** <in / out, only if not obvious>
> **Assumptions:**
>
> - <assumption>
>
> **Open questions:**
>
> - <question> (default: <your default>)
>
> Does this match what you have in mind, or should I adjust before I start?

## Review Checklist

- [ ] Stated goal and problem in your own words, not the user's phrasing
- [ ] Made no changes and ran nothing with side effects
- [ ] Listed every inference as an assumption
- [ ] Asked only questions whose answers change the plan, each with a default
- [ ] Stopped and asked for confirmation
