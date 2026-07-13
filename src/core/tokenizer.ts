import { DelimiterPair, FootnoteDef, FootnoteRef, ParsedFootnotes } from './types';
import { buildMasks, isMasked } from './delimiters';
import {
	dedent,
	isBlank,
	isIndented,
	lineStartOffsets,
	offsetToLine,
	splitLinesWithOffsets,
} from './lines';

// Pure, dependency-free footnote tokenizer. A single scan first derives the
// excluded-region ranges from the configured delimiters, then footnote
// definitions and references are extracted only from text outside those
// ranges. No external Markdown parser is used.

// Label = one or more non-whitespace, non-']' characters (matches Obsidian /
// Pandoc footnote labels: numeric like `1` or named like `note-a`).
const REF_PATTERN = /\[\^([^\]\s]+)\]/g;

// A definition line: up to 3 spaces of indent, then `[^label]:`.
const DEF_LINE = /^( {0,3})\[\^([^\]\s]+)\]:/;

export function parseFootnotes(text: string, pairs: DelimiterPair[]): ParsedFootnotes {
	const masks = buildMasks(text, pairs);
	const starts = lineStartOffsets(text);
	const defs = parseDefinitions(text, masks);
	const refs = parseReferences(text, masks, starts);
	return { refs, defs, masks };
}

// Walk the document line by line. Each unmasked line matching `[^label]:` opens
// a definition block whose extent is grown over following blank/indented lines
// (Pandoc multi-paragraph rule); a non-blank, non-indented line ends the block.
// Trailing blank lines are not absorbed into the block.
function parseDefinitions(text: string, masks: ReturnType<typeof buildMasks>): FootnoteDef[] {
	const lines = splitLinesWithOffsets(text);
	const defs: FootnoteDef[] = [];

	let li = 0;
	while (li < lines.length) {
		const line = lines[li];
		if (!line) {
			li++;
			continue;
		}
		const m = DEF_LINE.exec(line.text);
		if (!m) {
			li++;
			continue;
		}
		const indent = (m[1] ?? '').length;
		const bracketOffset = line.start + indent;
		// A definition whose bracket is inside a masked region (e.g. a fenced
		// code block) is not a real definition.
		if (isMasked(bracketOffset, masks)) {
			li++;
			continue;
		}

		const label = m[2] as string;
		const firstLineRest = line.text.slice(m[0].length); // after "[^label]:"
		const contentLines: string[] = [firstLineRest.replace(/^ /, '')];

		// Grow the block. `committed` is the last line index that is definitely
		// part of the block; pending blank lines are only committed once a later
		// indented line proves they were interior blanks.
		let committed = li;
		let pendingBlanks: number[] = [];
		let j = li + 1;
		for (; j < lines.length; j++) {
			const next = lines[j];
			if (!next) break;
			if (isBlank(next.text)) {
				pendingBlanks.push(j);
				continue;
			}
			if (isIndented(next.text)) {
				for (let k = 0; k < pendingBlanks.length; k++) contentLines.push('');
				pendingBlanks = [];
				contentLines.push(dedent(next.text));
				committed = j;
				continue;
			}
			break; // non-blank, non-indented → block ends before this line
		}

		const lastLine = lines[committed] as { text: string; start: number };
		const end = lastLine.start + lastLine.text.length;
		defs.push({
			label,
			start: bracketOffset,
			end,
			line: li,
			content: contentLines.join('\n').replace(/\s+$/, ''),
			raw: text.slice(bracketOffset, end),
		});

		li = committed + 1;
	}

	return defs;
}

// Every `[^label]` outside a mask is a reference, except the `[^label]` that is
// the head of a definition (line start, ≤3 spaces indent, immediately followed
// by ':'). References inside definition bodies (a footnote citing another) are
// kept.
function parseReferences(
	text: string,
	masks: ReturnType<typeof buildMasks>,
	starts: number[],
): FootnoteRef[] {
	const refs: FootnoteRef[] = [];
	REF_PATTERN.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = REF_PATTERN.exec(text)) !== null) {
		const start = m.index;
		const end = start + m[0].length;
		if (isMasked(start, masks)) continue;
		if (isDefinitionHead(text, start, end)) continue;
		refs.push({
			label: m[1] as string,
			start,
			end,
			line: offsetToLine(start, starts),
		});
	}
	return refs;
}

// True when the `[^label]` at [start, end) is the head of a definition: the
// next character is ':' and only up to three spaces precede it on the line.
function isDefinitionHead(text: string, start: number, end: number): boolean {
	if (text[end] !== ':') return false;
	let spaces = 0;
	for (let j = start - 1; j >= 0; j--) {
		const ch = text[j];
		if (ch === '\n') break;
		if (ch === ' ') {
			spaces++;
			continue;
		}
		return false; // a non-space character precedes it on the line
	}
	return spaces <= 3;
}
