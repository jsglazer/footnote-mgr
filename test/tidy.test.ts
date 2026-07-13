import { describe, it, expect } from 'vitest';
import { tidyDocument, TidyConfig } from '../src/core/tidy';

const CONFIG: TidyConfig = {
	delimiters: '```',
	consolidate: { target: 'end', headingText: 'Footnotes', headingLevel: 2 },
};
const BOTH = { reindex: true, consolidate: true };

describe('tidyDocument', () => {
	it('re-indexes then consolidates in one pass', () => {
		const text = 'a[^2] b[^1].\n\n[^1]: one\n[^2]: two';
		const r = tidyDocument(text, CONFIG, BOTH);
		expect(r.skipped).toBe(false);
		expect(r.changed).toBe(true);
		expect(r.text).toBe('a[^1] b[^2].\n\n[^1]: two\n\n[^2]: one\n');
	});

	it('is idempotent — a second pass changes nothing', () => {
		const text = 'a[^2] b[^1].\n\n[^1]: one\n[^2]: two';
		const once = tidyDocument(text, CONFIG, BOTH).text;
		const twice = tidyDocument(once, CONFIG, BOTH);
		expect(twice.text).toBe(once);
		expect(twice.changed).toBe(false);
	});

	it('skips (does not mutate) an unsafe note and reports the issues', () => {
		const text = 'a[^1] b[^2].\n\n[^1]: one'; // [^2] orphaned
		const r = tidyDocument(text, CONFIG, BOTH);
		expect(r.skipped).toBe(true);
		expect(r.changed).toBe(false);
		expect(r.text).toBe(text);
		expect(r.issues).toContainEqual({ type: 'orphan-ref', label: '2' });
	});

	it('honours per-capability gating: re-index only leaves definitions in place', () => {
		const text = 'a[^2] b[^1].\n\n[^1]: one\n[^2]: two';
		const r = tidyDocument(text, CONFIG, { reindex: true, consolidate: false });
		expect(r.text).toBe('a[^1] b[^2].\n\n[^2]: one\n[^1]: two');
	});

	it('honours per-capability gating: consolidate only leaves numbering alone', () => {
		const text = 'a[^2] b[^1].\n\n[^1]: one\n[^2]: two';
		const r = tidyDocument(text, CONFIG, { reindex: false, consolidate: true });
		expect(r.text).toBe('a[^2] b[^1].\n\n[^2]: two\n\n[^1]: one\n');
	});

	it('does nothing when both capabilities are off', () => {
		const text = 'a[^2] b[^1].\n\n[^1]: one\n[^2]: two';
		const r = tidyDocument(text, CONFIG, { reindex: false, consolidate: false });
		expect(r.changed).toBe(false);
		expect(r.text).toBe(text);
	});

	it('is a no-op on a note with no footnotes', () => {
		const r = tidyDocument('just prose', CONFIG, BOTH);
		expect(r.changed).toBe(false);
		expect(r.skipped).toBe(false);
	});
});
