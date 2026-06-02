# Valerio Codex Subagents Setup

Questo pacchetto va estratto nella root del progetto.

## Cosa contiene

```txt
AGENTS.md
.codex/agents/*.toml
.codex/prompts/*.md
docs/*.md
scripts/validate-style.mjs
.github/workflows/ci.yml
```

## Subagent veri

I subagent project-scoped sono in:

```txt
.codex/agents/
```

Ogni file TOML definisce un custom agent Codex:

- `valerio-planner`
- `valerio-architect`
- `valerio-implementer`
- `valerio-type-safety-reviewer`
- `valerio-compatibility-reviewer`
- `valerio-code-style-reviewer`
- `valerio-tester`
- `valerio-reviewer`
- `valerio-cleanup`

## Primo prompt da dare a Codex

```txt
Read AGENTS.md and all custom agents under .codex/agents/.

Do not edit code yet.

Use subagents:
- valerio-planner
- valerio-architect
- valerio-compatibility-reviewer
- valerio-code-style-reviewer

Task:
Analyze the repository and create docs/refactor-plan.md with small milestones for the next big update.

Stop after writing the plan.
```

## Prompt per ogni step

Usa il template:

```txt
Read AGENTS.md, docs/architecture.md, docs/state-contract.md, docs/socket-contract.md.

Use a subagent workflow.

Only the main agent may edit files.
Subagents are read-only.

Current step:
[WRITE STEP HERE]

Before editing, spawn:
- valerio-planner
- valerio-architect
- valerio-type-safety-reviewer
- valerio-compatibility-reviewer
- valerio-code-style-reviewer

If any blocks, stop.

If approved, implement only this step.

After editing, run:
- npm run typecheck
- npm run lint --if-present
- npm test --if-present
- npm run validate:style --if-present
- npm run build

Then spawn:
- valerio-type-safety-reviewer
- valerio-compatibility-reviewer
- valerio-code-style-reviewer
- valerio-tester
- valerio-reviewer

Fix only blockers.
Do not start the next step.
```

## package.json

Aggiungi almeno:

```json
{
  "scripts": {
    "validate:style": "node scripts/validate-style.mjs"
  }
}
```

Se passi a TypeScript:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "validate:style": "node scripts/validate-style.mjs"
  }
}
```

## Nota

Non far modificare codice in parallelo a più subagent.
Il workflow professionale è:

- main agent = writer
- subagents = reviewer / validator / tester
