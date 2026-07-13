import { splitLinesWithOffsets, isBlank } from './lines';

export interface Range {
	start: number;
	end: number;
}

// Remove the given half-open ranges from text. Ranges may be in any order; they
// are sorted and applied right-to-left so earlier offsets stay valid.
export function removeRanges(text: string, ranges: Range[]): string {
	const sorted = [...ranges].sort((a, b) => b.start - a.start);
	let out = text;
	for (const r of sorted) {
		out = out.slice(0, r.start) + out.slice(r.end);
	}
	return out;
}

// Collapse runs of blank lines to a single blank line and trim leading and
// trailing blank lines. Whitespace-only lines count as blank, so the leftover
// indentation and empty lines left behind when a definition block is removed
// are cleaned up deterministically (which keeps the consolidation idempotent).
export function normalizeBlankLines(text: string): string {
	const lines = splitLinesWithOffsets(text).map((l) => l.text);
	const out: string[] = [];
	let prevBlank = false;
	for (const line of lines) {
		const blank = isBlank(line);
		if (blank) {
			if (!prevBlank && out.length > 0) out.push('');
			prevBlank = true;
		} else {
			out.push(line);
			prevBlank = false;
		}
	}
	while (out.length > 0 && out[out.length - 1] === '') out.pop();
	return out.join('\n');
}
