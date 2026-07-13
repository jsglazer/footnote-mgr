import { DelimiterPair, MaskRange } from './types';

// Parse the user-configured exclusion list into delimiter pairs. One pair per
// non-blank line. A line with a single whitespace-delimited token is a
// symmetric delimiter (open === close, e.g. ``` or $$ or $); a line with two
// tokens is an asymmetric pair (open then close, e.g. `<!-- -->`). Extra
// tokens on a line are ignored. This keeps exclusions fully user-configurable
// rather than hard-coding any block type.
export function parseDelimiters(config: string): DelimiterPair[] {
	const pairs: DelimiterPair[] = [];
	for (const rawLine of config.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) continue;
		const tokens = line.split(/\s+/);
		const open = tokens[0];
		if (!open) continue;
		const close = tokens.length >= 2 ? (tokens[1] as string) : open;
		pairs.push({ open, close });
	}
	return pairs;
}

// Build the list of excluded (masked) ranges in a single left-to-right scan.
// At each position the longest matching opener wins (so ``` beats `, and $$
// beats $); once a region opens, everything through its matching closer is
// masked and the scan resumes after the closer. An unterminated opener masks
// to end of document. Returned ranges are ordered and non-overlapping.
export function buildMasks(text: string, pairs: DelimiterPair[]): MaskRange[] {
	const masks: MaskRange[] = [];
	if (pairs.length === 0) return masks;

	// Longest opener first so multi-char delimiters take precedence at a shared
	// starting position.
	const sorted = [...pairs].sort((a, b) => b.open.length - a.open.length);
	const n = text.length;
	let i = 0;

	while (i < n) {
		let matched: DelimiterPair | null = null;
		for (const p of sorted) {
			if (p.open.length > 0 && text.startsWith(p.open, i)) {
				matched = p;
				break;
			}
		}
		if (!matched) {
			i++;
			continue;
		}

		const contentStart = i + matched.open.length;
		const closeIdx = text.indexOf(matched.close, contentStart);
		if (closeIdx === -1) {
			masks.push({ start: i, end: n });
			break;
		}
		const end = closeIdx + matched.close.length;
		masks.push({ start: i, end });
		i = end;
	}
	return masks;
}

// True when `offset` falls inside any masked range. Ranges are half-open.
export function isMasked(offset: number, masks: MaskRange[]): boolean {
	for (const m of masks) {
		if (offset >= m.start && offset < m.end) return true;
	}
	return false;
}
