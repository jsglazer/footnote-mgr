// Shared, Obsidian-free types for the footnote engine. Everything under
// src/core/ is a pure module: it imports nothing from `obsidian` and depends
// only on the standard library, so the whole engine is exercised by headless
// Vitest tests.

// A configured exclusion delimiter pair. `open === close` for symmetric
// delimiters (```, $$, $, backticks); they differ for asymmetric ones
// (<!-- … -->).
export interface DelimiterPair {
	open: string;
	close: string;
}

// A masked (excluded) character range, half-open: [start, end). Footnote
// tokens whose opening bracket falls inside a mask are ignored.
export interface MaskRange {
	start: number;
	end: number;
}

// A footnote reference token — `[^label]` used inline in the body.
export interface FootnoteRef {
	label: string;
	start: number; // offset of the '['
	end: number; // offset just past the ']'
	line: number; // 0-based line index of the reference
}

// A footnote definition — `[^label]: …`, possibly spanning multiple indented
// lines/paragraphs.
export interface FootnoteDef {
	label: string;
	start: number; // offset of the '[' that opens the definition
	end: number; // offset just past the last character of the block (exclusive)
	line: number; // 0-based line index of the '[^label]:' line
	content: string; // definition text, prefix stripped and continuations dedented
	raw: string; // exact source of the block, text.slice(start, end)
}

export interface ParsedFootnotes {
	refs: FootnoteRef[];
	defs: FootnoteDef[];
	masks: MaskRange[];
}
