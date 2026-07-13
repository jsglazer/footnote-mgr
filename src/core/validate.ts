import { ParsedFootnotes } from './types';

// A footnote-set problem that makes an automatic rewrite unsafe.
export interface ValidationIssue {
	type: 'orphan-ref' | 'unreferenced-def' | 'duplicate-def';
	label: string;
}

export interface ValidationResult {
	ok: boolean;
	issues: ValidationIssue[];
}

// Guard against silent data loss: a note is only safe to transform when every
// reference resolves to exactly one definition and every definition is
// referenced. Orphaned references, unreferenced definitions, and duplicate
// definition labels each block the transform so nothing is deleted or
// fabricated. A note with no footnotes at all is trivially ok.
export function validateFootnotes(parsed: ParsedFootnotes): ValidationResult {
	const issues: ValidationIssue[] = [];

	const defCounts = new Map<string, number>();
	for (const d of parsed.defs) defCounts.set(d.label, (defCounts.get(d.label) ?? 0) + 1);

	const refLabels = new Set<string>();
	for (const r of parsed.refs) refLabels.add(r.label);

	for (const [label, count] of defCounts) {
		if (count > 1) issues.push({ type: 'duplicate-def', label });
	}

	// Orphaned references, reported once per distinct label in appearance order.
	const reportedOrphan = new Set<string>();
	for (const r of parsed.refs) {
		if (!defCounts.has(r.label) && !reportedOrphan.has(r.label)) {
			reportedOrphan.add(r.label);
			issues.push({ type: 'orphan-ref', label: r.label });
		}
	}

	for (const label of defCounts.keys()) {
		if (!refLabels.has(label)) issues.push({ type: 'unreferenced-def', label });
	}

	return { ok: issues.length === 0, issues };
}

// Human-readable one-liner for the skip Notice.
export function describeIssues(issues: ValidationIssue[]): string {
	const parts = issues.map((i) => {
		switch (i.type) {
			case 'orphan-ref':
				return `reference [^${i.label}] has no definition`;
			case 'unreferenced-def':
				return `definition [^${i.label}] is never referenced`;
			case 'duplicate-def':
				return `definition [^${i.label}] is defined more than once`;
		}
	});
	return parts.join('; ');
}
