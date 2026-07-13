import { describe, it, expect } from 'vitest';
import { parseFootnotes } from '../src/core/tokenizer';
import { validateFootnotes } from '../src/core/validate';
import { parseDelimiters } from '../src/core/delimiters';

const CODE = parseDelimiters('```');
const validate = (text: string) => validateFootnotes(parseFootnotes(text, CODE));

describe('validateFootnotes', () => {
	it('passes a clean note where every ref has one def and vice versa', () => {
		const r = validate('A[^1] B[^2].\n\n[^1]: one\n[^2]: two');
		expect(r.ok).toBe(true);
		expect(r.issues).toEqual([]);
	});

	it('passes a note with no footnotes at all', () => {
		expect(validate('just prose').ok).toBe(true);
	});

	it('flags an orphaned reference (no definition)', () => {
		const r = validate('A[^1] B[^2].\n\n[^1]: one');
		expect(r.ok).toBe(false);
		expect(r.issues).toContainEqual({ type: 'orphan-ref', label: '2' });
	});

	it('flags an unreferenced definition', () => {
		const r = validate('A[^1].\n\n[^1]: one\n[^2]: never cited');
		expect(r.ok).toBe(false);
		expect(r.issues).toContainEqual({ type: 'unreferenced-def', label: '2' });
	});

	it('flags a duplicate definition label', () => {
		const r = validate('A[^1].\n\n[^1]: one\n[^1]: again');
		expect(r.ok).toBe(false);
		expect(r.issues).toContainEqual({ type: 'duplicate-def', label: '1' });
	});
});
