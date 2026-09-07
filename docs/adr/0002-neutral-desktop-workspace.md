# ADR 0002: Neutral desktop workspace and valid theme tokens

- status: accepted
- date: 2026-09-05
- spike: [runtime probe](../../spikes/desktop-theme/NOTES.md)

## Context

The user requested a friendlier desktop interface using a Codex screenshot as the design reference. Three toolbar rows, always-open schema editing and three overlapping activity columns distracted from starting an extraction. Existing channel-valued light-dark tokens were invalid CSS.

## Decision

Use a persistent sidebar, contextual toolbar, bottom source composer and progressive disclosure of schema editing. Retain real extraction, stored history, schema revisions and theme preferences. Use a neutral charcoal palette with separate sidebar/composer surfaces and semantic status colors. No new dependency.

## Why

This adapts the supplied composition to video extraction without introducing chat functionality. Full-color theme tokens with relative RGB alpha preserve existing Tailwind opacity utilities and the current color-scheme mechanism. A separate dark-class palette would duplicate preference logic.

## Implementation

The renderer shell owns navigation and focus restoration. Existing pages and engine calls remain in place. Schema menus choose the side with space; custom editing is collapsed initially. Invalid source inspection disables submission, and inspection errors remain visible. Shared tokens repaint all existing pages.

## Correct implementation next time

Validate complete CSS values in the actual runtime, not only TypeScript. Use light-dark for colors, never raw channels or complete box-shadow lists. Test alpha modifiers and alias chains. Keep the action and error near the source. Preserve keyboard focus whenever a navigation toggle is unmounted.

## Limitations

The reference is a different product and viewport, so text, icons and dimensions are adapted rather than pixel-cloned. Live validation covers navigation, schemas, inspection, theme, keyboard and zoom. Existing automated tests do not prove all provider extraction paths, full accessibility or packaged distribution. An extraction started by the user during validation was left running.

## References

- [MDN light-dark](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark)
- [MDN relative colors](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Colors/Using_relative_colors)
- [Apple sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [Apple dark mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- Vault: [full-color theme token gotcha](/Users/dontizi/Obsidian/vault/engineering/gotchas/light-dark-full-color-tokens.md).
