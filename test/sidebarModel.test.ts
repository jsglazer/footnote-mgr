import { describe, it, expect } from 'vitest';
import { sidebarEntriesFor } from '../src/core/sidebarModel';
import { parseDelimiters } from '../src/core/delimiters';

const CODE = parseDelimiters('```');

describe('buildSidebarEntries', () => {
	it('lists footnotes in first-appearance order with ref and def offsets', () => {
		const text = 'a[^2] b[^1].\n\n[^1]: one\n[^2]: two';
		const entries = sidebarEntriesFor(text, CODE);
		expect(entries.map((e) => e.label)).toEqual(['2', '1']);
		expect(entries[0]!.content).toBe('two');
		expect(entries[0]!.firstRefOffset).toBe(text.indexOf('[^2]'));
		expect(entries[0]!.defOffset).toBe(text.indexOf('[^2]: two'));
	});

	it('still lists a reference with no definition (orphan tolerated)', () => {
		const text = 'a[^1] b[^2].\n\n[^1]: one';
		const entries = sidebarEntriesFor(text, CODE);
		const orphan = entries.find((e) => e.label === '2')!;
		expect(orphan.defOffset).toBeNull();
		expect(orphan.content).toBe('');
	});

	it('still lists an unreferenced definition', () => {
		const text = 'a[^1].\n\n[^1]: one\n[^2]: never cited';
		const entries = sidebarEntriesFor(text, CODE);
		const un = entries.find((e) => e.label === '2')!;
		expect(un.firstRefOffset).toBeNull();
		expect(un.content).toBe('never cited');
	});
});
