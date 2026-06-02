# Valerio Codex Agents Pack

Questo pacchetto contiene una struttura professionale per far lavorare Codex sul grande refactor di Valerio The Game.

## Cosa contiene

```txt
AGENTS.md
.codex/prompts/
  orchestrator.md
  planner.md
  architecture-reviewer.md
  implementation.md
  type-safety-reviewer.md
  compatibility-reviewer.md
  code-style-validator.md
  test-reviewer.md
  reviewer.md
  cleanup.md
  step-1-contracts.md
  step-2-rules.md
  step-3-server-extraction.md
  step-4-serializer.md
docs/
  architecture.md
  state-contract.md
  socket-contract.md
  refactor-plan.md
scripts/
  validate-contracts.mjs
  validate-style.mjs
  validate-refactor.mjs
.github/workflows/ci.yml
```

## Come installarlo

Copia tutto il contenuto di questa cartella nel root del progetto.

Poi, se vuoi usare gli script, aggiungi al `package.json`:

```json
{
  "scripts": {
    "validate:contracts": "node scripts/validate-contracts.mjs",
    "validate:style": "node scripts/validate-style.mjs",
    "validate:refactor": "node scripts/validate-refactor.mjs"
  }
}
```

## Prompt iniziale per Codex

```txt
Read AGENTS.md and docs/architecture.md, docs/state-contract.md, docs/socket-contract.md.

Use .codex/prompts/orchestrator.md as workflow.

Current step:
Run .codex/prompts/step-1-contracts.md.

Only one writer may edit code.
All reviewers are read-only.
If any reviewer blocks, stop and report blockers.
```

## Regola principale

Un solo agent scrive codice. Gli altri validano.
