import { App, PluginSettingTab, Setting } from 'obsidian';
import type FootnoteMgrPlugin from './main';
import { ConsolidateConfig } from './core/consolidate';
import { TidyConfig } from './core/tidy';
import { isDarkTheme } from './util';

// ── Data model ─────────────────────────────────────────────────────────────

// A color plus an enabled flag (the checkbox in the highlight grid). A disabled
// color is not applied.
export interface ColorOption {
	enabled: boolean;
	color: string; // '#rrggbb' or ''
}

export interface HighlightThemeStyle {
	fr: ColorOption; // sidebar text color when a footnote is highlighted
	bg: ColorOption; // sidebar background color when a footnote is highlighted
}

export interface HighlightStyle {
	light: HighlightThemeStyle;
	dark: HighlightThemeStyle;
}

export interface FootnoteMgrSettings {
	// Re-indexing capability (independent on/off and manual-vs-automatic).
	reindexEnabled: boolean;
	reindexAuto: boolean;

	// Consolidation capability (independent on/off and manual-vs-automatic).
	consolidateEnabled: boolean;
	consolidateAuto: boolean;
	consolidateTarget: 'end' | 'heading';
	consolidateHeadingText: string;
	consolidateHeadingLevel: number; // 1-6

	// Parser exclusions — one delimiter pair per line, pre-populated with the
	// fenced-code-block delimiter.
	excludedDelimiters: string;

	// Sidebar display.
	maxLines: number; // initial lines shown per footnote
	showFullByDefault: boolean; // "Full" toggle default
	idxHighlightEnabled: boolean; // "Idx" toggle default

	// Colors for the "highlight the footnote in the sidebar" behavior.
	highlightStyle: HighlightStyle;
}

export function colorOption(color = ''): ColorOption {
	return { enabled: color !== '', color };
}

function themeStyle(fr: string, bg: string): HighlightThemeStyle {
	return { fr: colorOption(fr), bg: colorOption(bg) };
}

export const FENCED_CODE_DELIMITER = '```';

export function defaultSettings(): FootnoteMgrSettings {
	return {
		reindexEnabled: true,
		reindexAuto: false,

		consolidateEnabled: true,
		consolidateAuto: false,
		consolidateTarget: 'end',
		consolidateHeadingText: 'Footnotes',
		consolidateHeadingLevel: 2,

		excludedDelimiters: FENCED_CODE_DELIMITER,

		maxLines: 3,
		showFullByDefault: false,
		idxHighlightEnabled: true,

		highlightStyle: {
			light: themeStyle('', '#fff3a0'),
			dark: themeStyle('', '#4d4a1f'),
		},
	};
}

// ── Config adapters (shell settings → pure-core config) ─────────────────────

export function toConsolidateConfig(s: FootnoteMgrSettings): ConsolidateConfig {
	return {
		target: s.consolidateTarget,
		headingText: s.consolidateHeadingText,
		headingLevel: s.consolidateHeadingLevel,
	};
}

export function toTidyConfig(s: FootnoteMgrSettings): TidyConfig {
	return { delimiters: s.excludedDelimiters, consolidate: toConsolidateConfig(s) };
}

// ── Settings migration ──────────────────────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> | null {
	return v !== null && typeof v === 'object' && !Array.isArray(v)
		? (v as Record<string, unknown>)
		: null;
}

function readString(v: unknown, fallback: string): string {
	return typeof v === 'string' ? v : fallback;
}

function readBool(v: unknown, fallback: boolean): boolean {
	return typeof v === 'boolean' ? v : fallback;
}

function readColorOption(v: unknown): ColorOption {
	const r = asRecord(v);
	if (!r) return colorOption();
	return { enabled: r.enabled === true, color: readString(r.color, '') };
}

function readThemeStyle(v: unknown, fallback: HighlightThemeStyle): HighlightThemeStyle {
	const r = asRecord(v);
	if (!r) return fallback;
	return { fr: readColorOption(r.fr), bg: readColorOption(r.bg) };
}

export function migrateSettings(raw: unknown): FootnoteMgrSettings {
	const s = defaultSettings();
	const r = asRecord(raw);
	if (!r) return s;

	s.reindexEnabled = readBool(r.reindexEnabled, s.reindexEnabled);
	s.reindexAuto = readBool(r.reindexAuto, s.reindexAuto);

	s.consolidateEnabled = readBool(r.consolidateEnabled, s.consolidateEnabled);
	s.consolidateAuto = readBool(r.consolidateAuto, s.consolidateAuto);
	s.consolidateTarget = r.consolidateTarget === 'heading' ? 'heading' : 'end';
	s.consolidateHeadingText = readString(r.consolidateHeadingText, s.consolidateHeadingText);
	if (typeof r.consolidateHeadingLevel === 'number') {
		s.consolidateHeadingLevel = clampLevel(r.consolidateHeadingLevel);
	}

	s.excludedDelimiters = readString(r.excludedDelimiters, s.excludedDelimiters);

	if (typeof r.maxLines === 'number' && Number.isFinite(r.maxLines)) {
		s.maxLines = Math.max(1, Math.floor(r.maxLines));
	}
	s.showFullByDefault = readBool(r.showFullByDefault, s.showFullByDefault);
	s.idxHighlightEnabled = readBool(r.idxHighlightEnabled, s.idxHighlightEnabled);

	const hs = asRecord(r.highlightStyle);
	if (hs) {
		s.highlightStyle = {
			light: readThemeStyle(hs.light, s.highlightStyle.light),
			dark: readThemeStyle(hs.dark, s.highlightStyle.dark),
		};
	}

	return s;
}

function clampLevel(n: number): number {
	return Math.min(6, Math.max(1, Math.floor(n)));
}

// ── Color helpers ───────────────────────────────────────────────────────────

export function isValidHex(s: string): boolean {
	return /^#[0-9a-fA-F]{6}$/.test(s);
}

// Accepts hex with or without the # prefix; always stores WITH # (needed for
// CSS). Returns '' for anything that is not a full 6-digit hex.
export function normalizeHex(value: string): string {
	const v = value.trim();
	if (!v) return '';
	if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
	if (/^[0-9a-fA-F]{6}$/.test(v)) return '#' + v;
	return '';
}

// Resolve the enabled colors for the active theme into concrete CSS values
// ('' = do not apply). Used by the shell to paint the highlighted sidebar row.
export function highlightColors(style: HighlightStyle): { fontColor: string; backgroundColor: string } {
	const theme = isDarkTheme() ? 'dark' : 'light';
	const t = style[theme];
	return {
		fontColor: t.fr.enabled ? t.fr.color : '',
		backgroundColor: t.bg.enabled ? t.bg.color : '',
	};
}

// ── Settings tab ────────────────────────────────────────────────────────────

export class FootnoteMgrSettingTab extends PluginSettingTab {
	plugin: FootnoteMgrPlugin;

	constructor(app: App, plugin: FootnoteMgrPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('fm-settings-tab');

		containerEl.createDiv({
			cls: 'fm-settings-version',
			text: `Footnote Manager v${this.plugin.manifest.version}`,
		});

		this.renderInfoPanel(containerEl);
		this.renderReindexSection(containerEl);
		this.renderConsolidateSection(containerEl);
		this.renderParserSection(containerEl);
		this.renderSidebarSection(containerEl);
		this.renderHighlightSection(containerEl);
	}

	private async save(): Promise<void> {
		await this.plugin.saveSettings();
		this.plugin.refreshSidebar();
	}

	private renderInfoPanel(containerEl: HTMLElement): void {
		const infoPanel = containerEl.createDiv({ cls: 'fm-info-panel' });
		const p = infoPanel.createEl('p');
		p.appendText(
			'Automatic passes run on file open, on manual save (Cmd/Ctrl+S), and every ' +
				'2 minutes while a note is active — only for capabilities set to Automatic. ' +
				'Notes with orphaned references, unreferenced definitions, or duplicate labels ' +
				'are skipped so nothing is lost.',
		);
	}

	private renderReindexSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Re-indexing').setHeading();

		this.renderToggle(
			containerEl,
			'Enable re-indexing',
			'Renumber numeric footnotes to run 1, 2, 3, … by first reference. Named footnotes are left untouched.',
			() => this.plugin.settings.reindexEnabled,
			(v) => (this.plugin.settings.reindexEnabled = v),
		);
		this.renderToggle(
			containerEl,
			'Automatic re-indexing',
			'Run re-indexing automatically on the triggers above (otherwise it runs only from the command or the sidebar refresh button).',
			() => this.plugin.settings.reindexAuto,
			(v) => (this.plugin.settings.reindexAuto = v),
		);
	}

	private renderConsolidateSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Consolidation').setHeading();

		this.renderToggle(
			containerEl,
			'Enable consolidation',
			'Gather all footnote definitions into one place, ordered by first reference.',
			() => this.plugin.settings.consolidateEnabled,
			(v) => (this.plugin.settings.consolidateEnabled = v),
		);
		this.renderToggle(
			containerEl,
			'Automatic consolidation',
			'Run consolidation automatically on the triggers above (otherwise it runs only from the command or the sidebar refresh button).',
			() => this.plugin.settings.consolidateAuto,
			(v) => (this.plugin.settings.consolidateAuto = v),
		);

		new Setting(containerEl)
			.setName('Consolidation destination')
			.setDesc('Where consolidated definitions are written.')
			.addDropdown((dd) =>
				dd
					.addOption('end', 'End of document')
					.addOption('heading', 'Under a heading')
					.setValue(this.plugin.settings.consolidateTarget)
					.onChange(async (v) => {
						this.plugin.settings.consolidateTarget = v === 'heading' ? 'heading' : 'end';
						await this.save();
						this.display();
					}),
			);

		if (this.plugin.settings.consolidateTarget === 'heading') {
			new Setting(containerEl)
				.setName('Heading text')
				.setDesc('The heading under which definitions are collected (created if absent).')
				.addText((text) =>
					text
						.setPlaceholder('Footnotes')
						.setValue(this.plugin.settings.consolidateHeadingText)
						.onChange(async (v) => {
							this.plugin.settings.consolidateHeadingText = v;
							await this.save();
						}),
				);

			new Setting(containerEl)
				.setName('Heading level')
				.setDesc('The Markdown heading level (1-6) to match and create.')
				.addDropdown((dd) => {
					for (let i = 1; i <= 6; i++) dd.addOption(String(i), `${'#'.repeat(i)} (H${i})`);
					dd.setValue(String(this.plugin.settings.consolidateHeadingLevel)).onChange(async (v) => {
						this.plugin.settings.consolidateHeadingLevel = clampLevel(Number(v));
						await this.save();
					});
				});
		}
	}

	private renderParserSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Parser exclusions').setHeading();
		containerEl.createEl('p', {
			text:
				'One delimiter pair per line. A single token is a symmetric delimiter ' +
				'(e.g. ``` or $$ or $); two tokens are an open/close pair (e.g. <!-- -->). ' +
				'Footnotes inside any listed region are ignored.',
			cls: 'setting-item-description',
		});

		new Setting(containerEl).setClass('fm-delimiter-setting').addTextArea((ta) => {
			ta.setValue(this.plugin.settings.excludedDelimiters).onChange(async (v) => {
				this.plugin.settings.excludedDelimiters = v;
				await this.save();
			});
			ta.inputEl.rows = 5;
			ta.inputEl.addClass('fm-delimiter-input');
		});
	}

	private renderSidebarSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Sidebar').setHeading();

		new Setting(containerEl)
			.setName('Maximum lines per footnote')
			.setDesc('How many lines of each footnote to show before it is truncated (the Full button overrides this).')
			.addSlider((sl) =>
				sl
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.maxLines)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.maxLines = v;
						await this.save();
					}),
			);

		this.renderToggle(
			containerEl,
			'Show full footnotes by default',
			'Start with every footnote expanded in the sidebar (the same as pressing Full).',
			() => this.plugin.settings.showFullByDefault,
			(v) => {
				this.plugin.settings.showFullByDefault = v;
				this.plugin.showFull = v;
			},
		);

		this.renderToggle(
			containerEl,
			'Highlight on index click',
			'Clicking a footnote reference in the document highlights the matching footnote in the sidebar (the same as the Idx button).',
			() => this.plugin.settings.idxHighlightEnabled,
			(v) => {
				this.plugin.settings.idxHighlightEnabled = v;
				this.plugin.idxHighlight = v;
			},
		);
	}

	private renderHighlightSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Highlight colors').setHeading();
		containerEl.createEl('p', {
			text:
				'Colors used to highlight a footnote in the sidebar when its index is clicked. ' +
				'Fr = text color, Bg = background; each checkbox controls whether that color is applied.',
			cls: 'setting-item-description',
		});
		this.renderHighlightGrid(containerEl);
	}

	private renderHighlightGrid(containerEl: HTMLElement): void {
		const style = this.plugin.settings.highlightStyle;

		const wrap = containerEl.createDiv('fm-grid-wrap');
		const table = wrap.createEl('table', { cls: 'fm-grid-table' });
		const thead = table.createEl('thead');

		const r1 = thead.createEl('tr');
		r1.createEl('th', { text: 'Light', attr: { colspan: '2' } });
		r1.createEl('th', { text: 'Dark', attr: { colspan: '2' }, cls: 'fm-grid-sep' });
		r1.createEl('th', { text: 'Example', attr: { rowspan: '2' }, cls: 'fm-grid-sep' });

		const r2 = thead.createEl('tr');
		r2.createEl('th', { text: 'Fr' });
		r2.createEl('th', { text: 'Bg' });
		r2.createEl('th', { text: 'Fr', cls: 'fm-grid-sep' });
		r2.createEl('th', { text: 'Bg' });

		const tbody = table.createEl('tbody');
		const tr = tbody.createEl('tr');

		let exampleTd: HTMLElement | null = null;
		const refreshExample = () => {
			if (!exampleTd) return;
			exampleTd.empty();
			const c = highlightColors(style);
			const chip = exampleTd.createEl('span', { text: 'Footnote', cls: 'fm-grid-example-chip' });
			chip.setCssStyles({ color: c.fontColor, backgroundColor: c.backgroundColor });
		};

		for (const theme of ['light', 'dark'] as const) {
			for (const field of ['fr', 'bg'] as const) {
				const td = tr.createEl('td', {
					cls: theme === 'dark' && field === 'fr' ? 'fm-grid-sep' : '',
				});
				this.renderColorCell(td, style[theme][field], refreshExample);
			}
		}

		exampleTd = tr.createEl('td', { cls: 'fm-grid-example fm-grid-sep' });
		refreshExample();
	}

	// One cell bound to a ColorOption: a checkbox, a swatch (native picker), and
	// an editable hex field — same idiom as annotation-manager. Setting a color by
	// either control auto-enables the checkbox; the checkbox alone toggles whether
	// the stored color is applied.
	private renderColorCell(td: HTMLElement, opt: ColorOption, onChanged: () => void): void {
		const wrap = td.createDiv('fm-grid-cell');
		const check = wrap.createEl('input', { attr: { type: 'checkbox' }, cls: 'fm-grid-check' });
		check.checked = opt.enabled;
		const picker = wrap.createEl('input', { attr: { type: 'color' }, cls: 'fm-grid-color' });
		picker.value = isValidHex(opt.color) ? opt.color : '#888888';
		const hex = wrap.createEl('input', {
			cls: 'fm-grid-hex',
			attr: { type: 'text', maxlength: '7', placeholder: '#hex', spellcheck: 'false' },
		});
		hex.value = isValidHex(opt.color) ? opt.color : '';

		const autoEnable = () => {
			if (!opt.enabled) {
				opt.enabled = true;
				check.checked = true;
			}
		};

		check.addEventListener('change', () => {
			opt.enabled = check.checked;
			if (opt.enabled && !isValidHex(opt.color)) {
				opt.color = picker.value;
				hex.value = picker.value;
			}
			void this.save();
			onChanged();
		});
		picker.addEventListener('input', () => {
			opt.color = picker.value;
			hex.value = picker.value;
			autoEnable();
			onChanged();
		});
		picker.addEventListener('change', () => {
			opt.color = picker.value;
			hex.value = picker.value;
			autoEnable();
			void this.save();
			onChanged();
		});
		hex.addEventListener('input', () => {
			const norm = normalizeHex(hex.value);
			if (!norm) return;
			opt.color = norm;
			picker.value = norm;
			autoEnable();
			onChanged();
		});
		hex.addEventListener('change', () => {
			const norm = normalizeHex(hex.value);
			if (norm) {
				hex.value = norm;
				opt.color = norm;
				picker.value = norm;
				autoEnable();
				void this.save();
				onChanged();
			} else {
				hex.value = isValidHex(opt.color) ? opt.color : '';
			}
		});
	}

	private renderToggle(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		getValue: () => boolean,
		setValue: (v: boolean) => void,
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle((toggle) =>
				toggle.setValue(getValue()).onChange(async (v) => {
					setValue(v);
					await this.save();
				}),
			);
	}
}
