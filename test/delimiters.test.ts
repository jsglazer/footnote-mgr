import { describe, it, expect } from 'vitest';
import { parseDelimiters, buildMasks, isMasked } from '../src/core/delimiters';

describe('parseDelimiters', () => {
	it('reads symmetric single-token lines and asymmetric two-token lines', () => {
		const pairs = parseDelimiters('```\n$$\n$\n<!-- -->\n');
		expect(pairs).toEqual([
			{ open: '```', close: '```' },
			{ open: '$$', close: '$$' },
			{ open: '$', close: '$' },
			{ open: '<!--', close: '-->' },
		]);
	});

	it('ignores blank lines and surrounding whitespace', () => {
		expect(parseDelimiters('\n  ```  \n\n')).toEqual([{ open: '```', close: '```' }]);
	});
});

describe('buildMasks / isMasked', () => {
	it('masks a fenced code block so its content is excluded', () => {
		const text = 'a\n```\n[^1]\n```\nb';
		const masks = buildMasks(text, parseDelimiters('```'));
		expect(masks).toHaveLength(1);
		const fnIdx = text.indexOf('[^1]');
		expect(isMasked(fnIdx, masks)).toBe(true);
		expect(isMasked(0, masks)).toBe(false);
	});

	it('lets the longest opener win ($$ before $)', () => {
		const text = '$$ x^2 $$ and $y$';
		const masks = buildMasks(text, parseDelimiters('$$\n$'));
		// The $$…$$ block and the $…$ inline span are both masked, separately.
		expect(masks).toHaveLength(2);
		expect(isMasked(text.indexOf('x^2'), masks)).toBe(true);
		expect(isMasked(text.indexOf('y'), masks)).toBe(true);
	});

	it('masks to end of document for an unterminated opener', () => {
		const text = 'ok\n```\nunclosed [^1]';
		const masks = buildMasks(text, parseDelimiters('```'));
		expect(masks).toHaveLength(1);
		expect(masks[0]!.end).toBe(text.length);
	});

	it('returns nothing when no delimiters are configured', () => {
		expect(buildMasks('```[^1]```', [])).toEqual([]);
	});
});
