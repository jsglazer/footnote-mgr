# Footnote Manager

An Obsidian plugin that **consolidates**, **re-indexes**, and **navigates** Markdown footnotes — combining the sidebar navigation of _Better Footnote_ with the tidy-up capabilities of _Tidy Footnotes_ in one clean, type-safe plugin.

## Features

### Tidy your footnotes

- **Consolidation** — gather every footnote definition into one place, ordered by first reference. Write them at the **end of the document** or under a **heading you choose** (text + level, e.g. `## Footnotes`). Definitions are relocated **verbatim** — never reformatted or reworded.
- **Re-indexing** — renumber numeric footnotes so they run `1, 2, 3, …` in order of first appearance (e.g. `[^1][^4][^2]` → `[^1][^2][^3]`). Named footnotes (`[^note]`) are left completely untouched.
- Each capability has its **own on/off switch** and its own **manual-vs-automatic** setting, so you can run either one without the other.

### Runs when you want it to

- **Command palette:** _Tidy footnotes in current note_ runs consolidation and re-indexing together.
- **Sidebar Refresh button** does the same.
- **Automatic passes** (for capabilities you mark _Automatic_) run on **file open**, on **manual save** (Cmd/Ctrl+S), and on a **recurring 2-minute timer** while a note is active. Obsidian's continuous background autosave never triggers a pass.
- A brief **status-bar indicator** appears only when a pass actually changes the note.

### Safe by design

- Notes with **orphaned references**, **unreferenced definitions**, or **duplicate labels** are **skipped** with a notice, rather than risk silent data loss.
- Every edit goes through a single **Obsidian editor transaction**, preserving your **cursor, selection, scroll position, and undo history**.
- All footnote parsing, re-indexing, and consolidation logic lives in a **pure, dependency-free core** (`src/core/`) with **zero Obsidian imports** and no external Markdown parser — and is covered by headless unit tests.

### Configurable exclusions

Footnotes inside excluded regions are ignored. The exclusion list is **fully user-configurable** — one delimiter pair per line:

```
```          ← fenced code blocks (pre-configured)
$$           ← display math $            ← inline math
<!-- -->     ← HTML comments (an open/close pair)
```

A single token is a symmetric delimiter; two tokens are an open/close pair.

### Footnote sidebar

A right-panel list of the current note's footnotes:

- **Click the number** to jump to the reference (index entry) in the document.
- **Click the body** to jump to the definition.
- **Full** — expand every footnote to its complete text (otherwise each is truncated to a configurable number of lines).
- **Idx** — clicking a footnote reference in the document highlights the matching footnote in the sidebar. Highlight colors are configurable for **light and dark themes** independently.

## Settings

| Group | Options |
| --- | --- |
| **Re-indexing** | Enable · Automatic |
| **Consolidation** | Enable · Automatic · Destination (end of document / heading) · Heading text · Heading level |
| **Parser exclusions** | Delimiter-pair list |
| **Sidebar** | Max lines per footnote · Show full by default · Highlight on index click |
| **Highlight colors** | Light/Dark × Fr/Bg color pickers |

## Installation

Until the plugin is in the Community Plugins directory, install manually:

1. Copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/footnote-mgr/` folder.
2. Reload Obsidian and enable **Footnote Manager** in **Settings → Community plugins**.

## Development

```bash
npm install npm run build      # type-check + bundle to main.js npm test           # headless Vitest unit tests for the pure core npm run lint       # ESLint (typescript-eslint + obsidianmd)
```

The pure engine under `src/core/` imports nothing from Obsidian and is exercised entirely by `test/`. The Obsidian shell (`src/main.ts`, `src/sidebar.ts`, `src/settings.ts`) wires it to the app, and every use of an undocumented Obsidian internal is confined to `src/obsidian/adapter.ts`.

## License

[MIT](LICENSE) © Josh Glazer
