import { DelimiterPair } from './types';
import { parseFootnotes } from './tokenizer';
import { validateFootnotes } from './validate';
import { buildMasks, isMasked } from './delimiters';
import { normalizeBlankLines, removeRanges } from './docutil';
import { splitLinesWithOffsets } from './lines';

export interface ConsolidateConfig {
	target: 'end' | 'heading';
	headingText: string; // e.g. 'Footnotes' (no leading #)
	headingLevel: number; // 1-6
}

// Gather every footnote definition into a single region — either the end of the
// document or a user-specified heading — ordered by first reference appearance.
// Definitions are relocated verbatim (never reformatted), so no footnote text is
// altered or lost. The operation is idempotent: running it again reproduces the
// same document. Only runs on a valid footnote set (see validateFootnotes).
export function consolidateDocument(
	text: string,
	pairs: DelimiterPair[],
	config: ConsolidateConfig,
): { text: string; changed: boolean } {
	const parsed = parseFootnotes(text, pairs);
	if (!validateFootnotes(parsed).ok) return { text, changed: false };
	if (parsed.defs.length === 0) return { text, changed: false };

	// Order definitions by the first reference that mentions their label.
	const firstRef = new Map<string, number>();
	parsed.refs.forEach((r, i) => {
		if (!firstRef.has(r.label)) firstRef.set(r.label, i);
	});
	const ordered = [...parsed.defs].sort(
		(a, b) => (firstRef.get(a.label) ?? 0) - (firstRef.get(b.label) ?? 0),
	);
	const defsBlock = ordered.map((d) => d.raw).join('\n\n');

	// Strip all existing definition blocks, then rebuild a clean body.
	const body = normalizeBlankLines(
		removeRanges(
			text,
			parsed.defs.map((d) => ({ start: d.start, end: d.end })),
		),
	);

	const result =
		config.target === 'heading'
			? insertUnderHeading(body, config, defsBlock, pairs)
			: appendAtEnd(body, defsBlock);

	return { text: result, changed: result !== text };
}

function appendAtEnd(body: string, defsBlock: string): string {
	const trimmed = body.replace(/\s+$/, '');
	return trimmed.length ? `${trimmed}\n\n${defsBlock}\n` : `${defsBlock}\n`;
}

// Place the consolidated block at the end of the target heading's section
// (the run of lines from the heading down to the next heading of the same or a
// higher level, or end of document). Non-definition content already under the
// heading is preserved above the block. If the heading does not exist it is
// created at the end of the document.
function insertUnderHeading(
	body: string,
	config: ConsolidateConfig,
	defsBlock: string,
	pairs: DelimiterPair[],
): string {
	const headingLine = `${'#'.repeat(config.headingLevel)} ${config.headingText.trim()}`;
	const masks = buildMasks(body, pairs);
	const lineInfos = splitLinesWithOffsets(body);
	const lines = lineInfos.map((l) => l.text);

	const headingIdx = findHeading(lineInfos, config, masks);
	if (headingIdx === -1) {
		const trimmed = body.replace(/\s+$/, '');
		const head = trimmed.length ? `${trimmed}\n\n` : '';
		return `${head}${headingLine}\n\n${defsBlock}\n`;
	}

	// Find the end of the heading's section: the next heading of level ≤ target.
	let sectionEnd = lines.length;
	for (let i = headingIdx + 1; i < lines.length; i++) {
		const lvl = headingLevel(lines[i] as string, (lineInfos[i] as { start: number }).start, masks);
		if (lvl > 0 && lvl <= config.headingLevel) {
			sectionEnd = i;
			break;
		}
	}

	// Trim trailing blank lines inside the section before appending the block.
	let bodyEnd = sectionEnd;
	while (bodyEnd > headingIdx + 1 && /^\s*$/.test(lines[bodyEnd - 1] as string)) bodyEnd--;

	const before = lines.slice(0, bodyEnd);
	const after = lines.slice(sectionEnd);
	const rebuilt = [...before, '', ...defsBlock.split('\n')];
	if (after.length) rebuilt.push('', ...after);
	return rebuilt.join('\n').replace(/\s+$/, '') + '\n';
}

// Index of the line that is a heading matching the configured level and text
// (case-sensitive, trailing spaces and closing #'s tolerated), skipping any
// heading inside a masked region. -1 when absent.
function findHeading(
	lineInfos: { text: string; start: number }[],
	config: ConsolidateConfig,
	masks: ReturnType<typeof buildMasks>,
): number {
	const wanted = config.headingText.trim();
	for (let i = 0; i < lineInfos.length; i++) {
		const info = lineInfos[i] as { text: string; start: number };
		if (isMasked(info.start, masks)) continue;
		const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(info.text);
		if (!m) continue;
		if ((m[1] as string).length !== config.headingLevel) continue;
		if ((m[2] as string).trim() !== wanted) continue;
		return i;
	}
	return -1;
}

// ATX heading level of a line (1-6), or 0 if it is not a heading or is masked.
function headingLevel(line: string, offset: number, masks: ReturnType<typeof buildMasks>): number {
	if (isMasked(offset, masks)) return 0;
	const m = /^(#{1,6})\s+\S/.exec(line);
	return m ? (m[1] as string).length : 0;
}
