# Controlled Refactor Step Prompt

Read `AGENTS.md`, `docs/architecture.md`, `docs/state-contract.md`, and `docs/socket-contract.md`.

Use a subagent workflow.

Rules:
- Only the main agent may edit files.
- Subagents are read-only reviewers/testers unless explicitly told otherwise.
- Work on one small step only.
- Do not change public socket events.
- Do not change serialized state shape.
- Do not change classic game behavior.
- Keep `src/game.js` compatible.
- Use TypeScript for protocol/state/rules/classes.
- No scattered global functions.
- No mega Utils.

Current step:
[WRITE THE STEP HERE]

Before editing:
Spawn these read-only subagents:
- valerio-planner
- valerio-architect
- valerio-type-safety-reviewer
- valerio-compatibility-reviewer
- valerio-code-style-reviewer

Each must return APPROVED or BLOCKED.
If any BLOCKED, stop.

If all are approved:
Implement only the current step.

After editing:
Run:
- npm run typecheck
- npm run lint --if-present
- npm test --if-present
- npm run build
- npm run validate:style --if-present

Then spawn read-only subagents:
- valerio-type-safety-reviewer
- valerio-compatibility-reviewer
- valerio-code-style-reviewer
- valerio-tester
- valerio-reviewer

If any BLOCKED, fix only blockers.
Do not start the next step.
