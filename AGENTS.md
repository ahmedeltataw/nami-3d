# Project operating instructions

- The temporary sole project lead is Codex Sol 6.1 running at effort ultra, until the owner changes it.
- Keep desktop chat quiet. Write here only when a card is merged, a blocker/problem occurs, or an owner decision is needed; use one concise line when needed.
- Send progress and status changes to `@Muse [factory]` on Telegram. Keep `board.json` and `briefs/lead-status.md` synchronized with those changes.
- Space CI checks (including `gh run view`) at least three minutes apart.
- Let delegated agents finish automatically; avoid repeated polling.
- Assign OpenCode models only low- or medium-complexity implementation tasks. Do not assign them code reviews or ask them to assess another model's work.
- Have a separate Codex subagent review OpenCode's changes. The lead also inspects the diff, resolves findings, and runs the relevant checks before accepting the work.

## Permanent implementation and visual review

- Apply antislop in `during` mode for this project: review while implementing, not only after completion. Read `~/.agents/skills/antislop/SKILL.md` and the relevant installed UI, accessibility, mobile-layout, copy, or comment module before making the corresponding changes.
- Review each coherent code change against its intended behavior and surrounding contracts during implementation. Use an independent reviewer for consequential multi-file changes; the lead resolves findings, inspects the final diff, and verifies before accepting the work. Keep isolated low-risk changes local.
- For changes that affect rendered scenes or page appearance, check the result in a running production build at desktop and mobile sizes. Compare with the project's approved renders and scene manifests.
- Exercise every affected control with mouse and keyboard; verify focus, reduced motion, mobile clipping, browser errors, and state changes.
- Inspect generated screenshots directly before changing an existing snapshot. Record every intentional snapshot update and its visible cause; do not change snapshots simply to clear a failing check.
- Run the checks required by the task and state their measured outcomes. A build or software-rendered capture does not prove GPU performance or final visual approval.
- If checks fail, compare the relevant check on the clean base where practical and list unresolved failures by their actual result.
