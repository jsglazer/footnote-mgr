import { describe, it, expect } from 'vitest';
import {
	defaultSettings,
	migrateSettings,
	normalizeHex,
	isValidHex,
	toTidyConfig,
	FENCED_CODE_DELIMITER,
} from '../src/settings';

describe('defaultSettings', () => {
	it('pre-populates the exclusion list with the fenced-code delimiter', () => {
		expect(defaultSettings().excludedDelimiters).toBe(FENCED_CODE_DELIMITER);
	});

	it('gives consolidation and re-indexing independent enable/auto flags', () => {
		const s = defaultSettings();
		expect(s).toMatchObject({
			reindexEnabled: true,
			reindexAuto: false,
			consolidateEnabled: true,
			consolidateAuto: false,
		});
	});
});

describe('migrateSettings', () => {
	it('returns defaults for a null / non-object blob', () => {
		expect(migrateSettings(null)).toEqual(defaultSettings());
		expect(migrateSettings(42)).toEqual(defaultSettings());
	});

	it('preserves known fields and clamps the heading level', () => {
		const s = migrateSettings({
			reindexAuto: true,
			consolidateTarget: 'heading',
			consolidateHeadingLevel: 99,
			maxLines: 8,
		});
		expect(s.reindexAuto).toBe(true);
		expect(s.consolidateTarget).toBe('heading');
		expect(s.consolidateHeadingLevel).toBe(6);
		expect(s.maxLines).toBe(8);
	});

	it('ignores an out-of-shape highlightStyle and keeps defaults', () => {
		const s = migrateSettings({ highlightStyle: 'nope' });
		expect(s.highlightStyle).toEqual(defaultSettings().highlightStyle);
	});
});

describe('toTidyConfig', () => {
	it('maps settings onto the pure-core tidy config', () => {
		const s = defaultSettings();
		s.consolidateTarget = 'heading';
		s.consolidateHeadingText = 'Notes';
		s.consolidateHeadingLevel = 3;
		expect(toTidyConfig(s)).toEqual({
			delimiters: '```',
			consolidate: { target: 'heading', headingText: 'Notes', headingLevel: 3 },
		});
	});
});

describe('hex helpers', () => {
	it('normalizeHex accepts hex with or without # and rejects junk', () => {
		expect(normalizeHex('ff6b6b')).toBe('#ff6b6b');
		expect(normalizeHex('#ABCDEF')).toBe('#ABCDEF');
		expect(normalizeHex('red')).toBe('');
		expect(normalizeHex('fff')).toBe('');
	});

	it('isValidHex requires a full 6-digit hex', () => {
		expect(isValidHex('#ff6b6b')).toBe(true);
		expect(isValidHex('#fff')).toBe(false);
	});
});
