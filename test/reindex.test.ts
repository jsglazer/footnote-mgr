import { describe, it, expect } from 'vitest';
import { reindexDocument } from '../src/core/reindex';
import { parseDelimiters } from '../src/core/delimiters';

const CODE = parseDelimiters('```');

describe('reindexDocument', () => {
	it('renumbers numeric footnotes by first-reference order', () => {
		const text = 'a[^1] b[^4] c[^2].\n\n[^1]: one\n[^4]: four\n[^2]: two';
		const { text: out, changed } = reindexDocument(text, CODE);
		expect(changed).toBe(true);
		expect(out).toBe('a[^1] b[^2] c[^3].\n\n[^1]: one\n[^2]: four\n[^3]: two');
	});

	it('leaves named footnotes untouched and does not number them', () => {
		const text = 'a[^5] b[^note] c[^3].\n\n[^5]: five\n[^note]: n\n[^3]: three';
		const { text: out } = reindexDocument(text, CODE);
		expect(out).toBe('a[^1] b[^note] c[^2].\n\n[^1]: five\n[^note]: n\n[^2]: three');
	});

	it('applies the same new number to every reference of a label', () => {
		const text = 'a[^2] b[^2] c[^1].\n\n[^2]: two\n[^1]: one';
		const { text: out } = reindexDocument(text, CODE);
		expect(out).toBe('a[^1] b[^1] c[^2].\n\n[^1]: two\n[^2]: one');
	});

	it('reports no change when already sequential', () => {
		const text = 'a[^1] b[^2].\n\n[^1]: one\n[^2]: two';
		expect(reindexDocument(text, CODE).changed).toBe(false);
	});

	it('refuses to reindex an invalid footnote set', () => {
		const text = 'a[^1] b[^3].\n\n[^1]: one'; // [^3] orphaned
		expect(reindexDocument(text, CODE).changed).toBe(false);
	});

	it('ignores numbers inside excluded code blocks', () => {
		const text = 'a[^2].\n\n```\n[^9] noise\n```\n\n[^2]: two';
		const { text: out } = reindexDocument(text, CODE);
		expect(out).toBe('a[^1].\n\n```\n[^9] noise\n```\n\n[^1]: two');
	});
});
