import { describe, it, expect } from 'vitest';
import { parseFootnotes } from '../src/core/tokenizer';
import { parseDelimiters } from '../src/core/delimiters';

const CODE = parseDelimiters('```');
const MATH = parseDelimiters('```\n$$\n$');

describe('reference parsing', () => {
	it('finds inline references and their labels in document order', () => {
		const text = 'See[^1] and[^note] and[^2].';
		const { refs } = parseFootnotes(text, CODE);
		expect(refs.map((r) => r.label)).toEqual(['1', 'note', '2']);
		expect(refs[0]!.start).toBe(text.indexOf('[^1]'));
	});

	it('does not treat a definition head as a reference', () => {
		const text = 'Body[^1].\n\n[^1]: the definition.';
		const { refs, defs } = parseFootnotes(text, CODE);
		expect(refs.map((r) => r.label)).toEqual(['1']);
		expect(defs.map((d) => d.label)).toEqual(['1']);
	});

	it('keeps a reference to another footnote inside a definition body', () => {
		const text = 'A[^1] B[^2].\n\n[^1]: see [^2] too.\n[^2]: second.';
		const { refs } = parseFootnotes(text, CODE);
		// two body refs + the [^2] cited inside [^1]'s definition
		expect(refs.filter((r) => r.label === '2')).toHaveLength(2);
	});
});

describe('exclusions', () => {
	it('ignores footnotes inside fenced code blocks', () => {
		const text = 'Real[^1].\n\n```\nnot a ref [^2]\n[^2]: not a def\n```\n\n[^1]: def.';
		const { refs, defs } = parseFootnotes(text, CODE);
		expect(refs.map((r) => r.label)).toEqual(['1']);
		expect(defs.map((d) => d.label)).toEqual(['1']);
	});

	it('ignores footnotes inside $$ and $ math when those delimiters are configured', () => {
		const text = 'Text[^1]. $$ a[^2] $$ and $b[^3]$ end.\n\n[^1]: def.';
		const { refs } = parseFootnotes(text, MATH);
		expect(refs.map((r) => r.label)).toEqual(['1']);
	});

	it('respects a custom delimiter pair', () => {
		const custom = parseDelimiters('<!-- -->');
		const text = 'Keep[^1]. <!-- hide [^2] --> done.';
		const { refs } = parseFootnotes(text, custom);
		expect(refs.map((r) => r.label)).toEqual(['1']);
	});
});

describe('definition boundaries', () => {
	it('captures a single-line definition and its content', () => {
		const text = '[^1]: hello world';
		const { defs } = parseFootnotes(text, CODE);
		expect(defs).toHaveLength(1);
		expect(defs[0]!.content).toBe('hello world');
		expect(defs[0]!.raw).toBe('[^1]: hello world');
	});

	it('captures a multi-paragraph definition with indented continuation', () => {
		const text = ['[^1]: first paragraph', '    still first', '', '    second paragraph', ''].join(
			'\n',
		);
		const { defs } = parseFootnotes(text, CODE);
		expect(defs).toHaveLength(1);
		expect(defs[0]!.content).toBe('first paragraph\nstill first\n\nsecond paragraph');
		// trailing blank line is not absorbed into the block
		expect(defs[0]!.raw.endsWith('second paragraph')).toBe(true);
	});

	it('stops the block at a non-indented following line', () => {
		const text = '[^1]: the note\nThis is body text, not the footnote.';
		const { defs } = parseFootnotes(text, CODE);
		expect(defs[0]!.content).toBe('the note');
		expect(defs[0]!.raw).toBe('[^1]: the note');
	});

	it('separates two adjacent definitions', () => {
		const text = '[^1]: one\n[^2]: two';
		const { defs } = parseFootnotes(text, CODE);
		expect(defs.map((d) => d.label)).toEqual(['1', '2']);
		expect(defs.map((d) => d.content)).toEqual(['one', 'two']);
	});
});
