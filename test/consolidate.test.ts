import { describe, it, expect } from 'vitest';
import { consolidateDocument, ConsolidateConfig } from '../src/core/consolidate';
import { parseDelimiters } from '../src/core/delimiters';

const CODE = parseDelimiters('```');
const END: ConsolidateConfig = { target: 'end', headingText: 'Footnotes', headingLevel: 2 };
const HEADING: ConsolidateConfig = { target: 'heading', headingText: 'Footnotes', headingLevel: 2 };

describe('consolidateDocument — end of document', () => {
	it('gathers scattered definitions at the end, ordered by first reference', () => {
		const text = 'Para one.[^1]\n\n[^1]: def one\n\nPara two.[^2]\n\n[^2]: def two';
		const { text: out, changed } = consolidateDocument(text, CODE, END);
		expect(changed).toBe(true);
		expect(out).toBe('Para one.[^1]\n\nPara two.[^2]\n\n[^1]: def one\n\n[^2]: def two\n');
	});

	it('orders by first reference appearance, not definition order', () => {
		const text = 'a[^2] b[^1].\n\n[^1]: one\n[^2]: two';
		const { text: out } = consolidateDocument(text, CODE, END);
		expect(out).toBe('a[^2] b[^1].\n\n[^2]: two\n\n[^1]: one\n');
	});

	it('relocates multi-paragraph definitions verbatim', () => {
		const text = 'x[^1]\n\n[^1]: first\n    continued\n\ny[^2]\n\n[^2]: second';
		const { text: out } = consolidateDocument(text, CODE, END);
		expect(out).toBe('x[^1]\n\ny[^2]\n\n[^1]: first\n    continued\n\n[^2]: second\n');
	});

	it('is idempotent (running twice yields the same document)', () => {
		const text = 'a[^2] b[^1].\n\n[^1]: one\n[^2]: two';
		const once = consolidateDocument(text, CODE, END).text;
		const twice = consolidateDocument(once, CODE, END);
		expect(twice.text).toBe(once);
		expect(twice.changed).toBe(false);
	});
});

describe('consolidateDocument — under a heading', () => {
	it('places definitions under an existing heading section', () => {
		const text = 'Body[^1] more[^2].\n\n## Footnotes\n\n[^2]: two\n[^1]: one';
		const { text: out } = consolidateDocument(text, CODE, HEADING);
		expect(out).toBe('Body[^1] more[^2].\n\n## Footnotes\n\n[^1]: one\n\n[^2]: two\n');
	});

	it('creates the heading at the end when it is absent', () => {
		const text = 'Body[^1].\n\n[^1]: one';
		const { text: out } = consolidateDocument(text, CODE, HEADING);
		expect(out).toBe('Body[^1].\n\n## Footnotes\n\n[^1]: one\n');
	});

	it('is idempotent under a heading', () => {
		const text = 'Body[^1] more[^2].\n\n## Footnotes\n\n[^2]: two\n[^1]: one';
		const once = consolidateDocument(text, CODE, HEADING).text;
		const twice = consolidateDocument(once, CODE, HEADING);
		expect(twice.text).toBe(once);
		expect(twice.changed).toBe(false);
	});

	it('stops the heading section at the next same-or-higher heading', () => {
		const text = 'B[^1].\n\n## Footnotes\n\n[^1]: one\n\n## After\n\ntail';
		const { text: out } = consolidateDocument(text, CODE, HEADING);
		expect(out).toBe('B[^1].\n\n## Footnotes\n\n[^1]: one\n\n## After\n\ntail\n');
	});
});

describe('consolidateDocument — safety', () => {
	it('refuses to consolidate an invalid footnote set', () => {
		const text = 'a[^1] b[^2].\n\n[^1]: one'; // [^2] orphaned
		expect(consolidateDocument(text, CODE, END).changed).toBe(false);
	});

	it('does nothing when there are no definitions', () => {
		expect(consolidateDocument('plain text', CODE, END).changed).toBe(false);
	});
});
