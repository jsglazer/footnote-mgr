import { parseDelimiters } from './delimiters';
import { parseFootnotes } from './tokenizer';
import { reindexDocument } from './reindex';
import { consolidateDocument, ConsolidateConfig } from './consolidate';
import { validateFootnotes, ValidationIssue } from './validate';

export interface TidyConfig {
	delimiters: string; // raw exclusion-list text
	consolidate: ConsolidateConfig;
}

export interface TidyOptions {
	reindex: boolean;
	consolidate: boolean;
}

export interface TidyResult {
	text: string;
	changed: boolean;
	skipped: boolean; // true when an unsafe footnote set blocked the transform
	issues: ValidationIssue[];
}

// Top-level entry point used by both the command/refresh button (manual) and
// the auto triggers. Re-indexing runs before consolidation so definitions are
// ordered by the final numbering. If the footnote set is unsafe, nothing is
// changed and the issues are returned for the caller to surface.
export function tidyDocument(
	text: string,
	config: TidyConfig,
	options: TidyOptions,
): TidyResult {
	if (!options.reindex && !options.consolidate) {
		return { text, changed: false, skipped: false, issues: [] };
	}

	const pairs = parseDelimiters(config.delimiters);
	const parsed = parseFootnotes(text, pairs);

	// Nothing to do on a note with no footnotes — not a skip, just a no-op.
	if (parsed.refs.length === 0 && parsed.defs.length === 0) {
		return { text, changed: false, skipped: false, issues: [] };
	}

	const validation = validateFootnotes(parsed);
	if (!validation.ok) {
		return { text, changed: false, skipped: true, issues: validation.issues };
	}

	let out = text;
	if (options.reindex) out = reindexDocument(out, pairs).text;
	if (options.consolidate) out = consolidateDocument(out, pairs, config.consolidate).text;

	return { text: out, changed: out !== text, skipped: false, issues: [] };
}
