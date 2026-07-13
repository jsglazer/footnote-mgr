// Small shell-side helpers. Kept out of src/core/ because they touch the DOM.

// Which Obsidian theme is active right now (drives the light/dark half of the
// highlight color setting).
export function isDarkTheme(): boolean {
	return activeDocument.body.classList.contains('theme-dark');
}
