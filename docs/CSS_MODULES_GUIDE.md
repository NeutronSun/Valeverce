# CSS Modules Guide

## Goal

Keep CSS stable, local, compact, and easy to reason about.

`app/globals.css` should only contain:

- CSS variables.
- Base reset.
- Font/body defaults.
- Global design tokens.
- Truly shared keyframes if needed.

Component layout and component visual styling belongs in `.module.css`.

## Naming

Use English class names only.

Preferred names:

- `root`
- `panel`
- `header`
- `body`
- `footer`
- `image`
- `overlay`
- `button`
- `selected`
- `disabled`
- `compact`
- `active`

Avoid old global names like:

- `game-card`
- `draft-pool`
- `action-hud`
- `right-panel`
- `top-player`

## Nesting

Use nested CSS inside modules:

```css
.button {
  color: var(--color-text);

  &:hover {
    filter: brightness(1.08);
  }

  &.disabled {
    opacity: 0.48;
  }
}
```

Do not create long global selectors to override another component.

## Dynamic Values

Use CSS custom properties for dynamic numbers.

Good:

```jsx
<div className={styles.resource} style={{ "--bar-ratio": ratio }}>
  <i />
</div>
```

```css
.resource i {
  transform: scaleX(var(--bar-ratio));
}
```

Avoid:

```jsx
<i style={{ width: `${percent}%` }} />
```

Current examples:

- `PlayerRail/PlayerRail.jsx`: `--bar-ratio`.
- `ChatFloat/ChatFloat.jsx`: `--chat-x`, `--chat-y`.
- `PhaseViews/PhaseViews.jsx`: `--pool-ratio`.

## Shared Colors

Use global variables for colors:

- `--color-bg`
- `--color-surface`
- `--color-border`
- `--color-text`
- `--color-muted`
- `--color-gold`
- `--color-health`
- `--color-mana`
- `--color-attack`
- `--color-defense`

VALERIO colors:

- `--stat-v`
- `--stat-a`
- `--stat-l`
- `--stat-e`
- `--stat-r`
- `--stat-i`
- `--stat-o`

Rarity colors:

- `--rarity-common`
- `--rarity-rare`
- `--rarity-epic`
- `--rarity-legendary`
- `--rarity-mythic`

## Rule

If a style only makes sense for one component, it belongs in that component module.
