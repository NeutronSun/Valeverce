Read `AGENTS.md` and all custom agents under `.codex/agents/`.

Do not edit code yet.

Use subagents:
- valerio-planner
- valerio-architect
- valerio-compatibility-reviewer
- valerio-code-style-reviewer

Task:
Analyze the repository and create `docs/refactor-plan.md` with small milestones for the next big update.

The plan must protect:
- classic game behavior
- public socket events
- serialized state shape
- `src/game.js` compatibility
- TypeScript contracts
- the user's coding style

Stop after writing the plan.
