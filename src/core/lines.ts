// Line utilities shared by the tokenizer and the document transforms. Kept
// dependency-free so both the pure core and its tests can use them.

export interface LineInfo {
	text: string; // line content without the trailing newline
	start: number; // offset of the first character of the line
}

// Split text into lines, preserving each line's absolute start offset. A
// trailing newline yields a final empty line (matching how editors count the
// position past the last newline).
export function splitLinesWithOffsets(text: string): LineInfo[] {
	const lines: LineInfo[] = [];
	let start = 0;
	for (let i = 0; i <= text.length; i++) {
		if (i === text.length || text[i] === '\n') {
			lines.push({ text: text.slice(start, i), start });
			start = i + 1;
		}
	}
	return lines;
}

// Precompute line-start offsets for fast offset→line lookups.
export function lineStartOffsets(text: string): number[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '\n') starts.push(i + 1);
	}
	return starts;
}

// 0-based line index containing `offset`, given precomputed line starts.
export function offsetToLine(offset: number, starts: number[]): number {
	// Linear-from-the-end is fine for note-sized documents; binary search would
	// be an over-optimization here.
	for (let i = starts.length - 1; i >= 0; i--) {
		if (offset >= (starts[i] as number)) return i;
	}
	return 0;
}

// A line counts as blank when it is empty or only whitespace.
export function isBlank(line: string): boolean {
	return /^\s*$/.test(line);
}

// True when a continuation line is indented enough (≥4 spaces or a leading tab)
// to belong to a footnote definition's body.
export function isIndented(line: string): boolean {
	return /^(\t| {4,})/.test(line);
}

// Remove one level of definition-body indentation (a leading tab or up to four
// spaces) from a continuation line.
export function dedent(line: string): string {
	if (line.startsWith('\t')) return line.slice(1);
	const m = /^ {1,4}/.exec(line);
	return m ? line.slice(m[0].length) : line;
}
