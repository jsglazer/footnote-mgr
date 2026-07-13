import { DelimiterPair } from './types';
import { parseFootnotes } from './tokenizer';
import { validateFootnotes } from './validate';

interface Replacement {
	start: number;
	end: number;
	text: string;
}

const NUMERIC = /^\d+$/;

// Re-index numeric footnotes so their labels run 1, 2, 3, … in order of first
// reference appearance (e.g. [^1][^4][^2] → [^1][^2][^3]). Named footnotes
// ([^note]) are left completely untouched and never consume a number. The
// document is only rewritten when the footnote set is valid (see
// validateFootnotes) — otherwise the original text is returned unchanged.
export function reindexDocument(
	text: string,
	pairs: DelimiterPair[],
): { text: string; changed: boolean } {
	const parsed = parseFootnotes(text, pairs);
	if (!validateFootnotes(parsed).ok) return { text, changed: false };

	// Distinct numeric labels in order of first reference appearance. refs are
	// already in document order.
	const order: string[] = [];
	const seen = new Set<string>();
	for (const r of parsed.refs) {
		if (NUMERIC.test(r.label) && !seen.has(r.label)) {
			seen.add(r.label);
			order.push(r.label);
		}
	}

	const remap = new Map<string, string>();
	order.forEach((label, i) => remap.set(label, String(i + 1)));

	// Collect every ref and def label token that changes, then apply as one
	// batch (right-to-left) so remaps never cascade into each other.
	const edits: Replacement[] = [];

	for (const r of parsed.refs) {
		const next = remap.get(r.label);
		if (next !== undefined && next !== r.label) {
			edits.push({ start: r.start, end: r.end, text: `[^${next}]` });
		}
	}
	for (const d of parsed.defs) {
		const next = remap.get(d.label);
		if (next !== undefined && next !== d.label) {
			// The label token is `[^label]` at the start of the definition block.
			const tokenEnd = d.start + 2 + d.label.length + 1; // '[^' + label + ']'
			edits.push({ start: d.start, end: tokenEnd, text: `[^${next}]` });
		}
	}

	if (edits.length === 0) return { text, changed: false };

	edits.sort((a, b) => b.start - a.start);
	let out = text;
	for (const e of edits) {
		out = out.slice(0, e.start) + e.text + out.slice(e.end);
	}
	return { text: out, changed: out !== text };
}
