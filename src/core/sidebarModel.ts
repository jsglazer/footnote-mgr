import { DelimiterPair, ParsedFootnotes } from './types';
import { parseFootnotes } from './tokenizer';

// One row in the footnote sidebar. Display-only and tolerant of imperfect
// notes (orphans / unreferenced defs are still listed), so the sidebar keeps
// working even when a tidy pass would be skipped.
export interface SidebarEntry {
	label: string;
	firstRefOffset: number | null; // jump target for the label button (index entry)
	defOffset: number | null; // jump target for the body (definition)
	defLine: number | null;
	content: string; // definition text ('' when there is no definition)
}

// Build sidebar rows in order of first appearance (whichever comes first, a
// reference or the definition). Every distinct label that appears as a
// reference or a definition gets exactly one row.
export function buildSidebarEntries(parsed: ParsedFootnotes): SidebarEntry[] {
	const firstAppearance = new Map<string, number>();
	const consider = (label: string, offset: number) => {
		const prev = firstAppearance.get(label);
		if (prev === undefined || offset < prev) firstAppearance.set(label, offset);
	};

	const firstRef = new Map<string, number>();
	for (const r of parsed.refs) {
		if (!firstRef.has(r.label)) firstRef.set(r.label, r.start);
		consider(r.label, r.start);
	}

	const def = new Map<string, { offset: number; line: number; content: string }>();
	for (const d of parsed.defs) {
		if (!def.has(d.label)) def.set(d.label, { offset: d.start, line: d.line, content: d.content });
		consider(d.label, d.start);
	}

	const labels = [...firstAppearance.keys()].sort(
		(a, b) => (firstAppearance.get(a) as number) - (firstAppearance.get(b) as number),
	);

	return labels.map((label) => {
		const d = def.get(label);
		return {
			label,
			firstRefOffset: firstRef.has(label) ? (firstRef.get(label) as number) : null,
			defOffset: d ? d.offset : null,
			defLine: d ? d.line : null,
			content: d ? d.content : '',
		};
	});
}

// Convenience wrapper for the shell: parse then build rows.
export function sidebarEntriesFor(text: string, pairs: DelimiterPair[]): SidebarEntry[] {
	return buildSidebarEntries(parseFootnotes(text, pairs));
}

// The footnote reference whose token spans `offset`, or null. Used by the shell
// to map a click in the editor to a footnote label without any DOM knowledge.
export function refLabelAtOffset(
	text: string,
	pairs: DelimiterPair[],
	offset: number,
): string | null {
	const { refs } = parseFootnotes(text, pairs);
	for (const r of refs) {
		if (offset >= r.start && offset < r.end) return r.label;
	}
	return null;
}

// The label of the Nth reference in document order (N = 0-based). Used by the
// shell to map the Nth rendered `.footnote-ref` element in Reading Mode to its
// label, since Obsidian renders references in document order.
export function refLabelByIndex(
	text: string,
	pairs: DelimiterPair[],
	index: number,
): string | null {
	const { refs } = parseFootnotes(text, pairs);
	const r = refs[index];
	return r ? r.label : null;
}
