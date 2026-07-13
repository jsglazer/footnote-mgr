import {
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	WorkspaceLeaf,
	debounce,
	setIcon,
} from 'obsidian';
import {
	FootnoteMgrSettings,
	FootnoteMgrSettingTab,
	defaultSettings,
	migrateSettings,
	toTidyConfig,
} from './settings';
import { FootnoteSidebarView, SIDEBAR_VIEW_TYPE } from './sidebar';
import { parseDelimiters } from './core/delimiters';
import { tidyDocument } from './core/tidy';
import { describeIssues } from './core/validate';
import {
	SidebarEntry,
	sidebarEntriesFor,
	refLabelAtOffset,
	refLabelByIndex,
} from './core/sidebarModel';
import {
	addRightRibbonButton,
	closestFootnoteRef,
	createEditorClickExtension,
	footnoteRefIndexInRoot,
	patchManualSave,
	EditorClick,
} from './obsidian/adapter';

const AUTO_INTERVAL_MS = 2 * 60 * 1000; // recurring 2-minute auto pass
const STATUS_CLEAR_MS = 4000;

export default class FootnoteMgrPlugin extends Plugin {
	settings: FootnoteMgrSettings = defaultSettings();

	// Runtime mirrors of the two sidebar toggle buttons (persisted to settings).
	showFull = false;
	idxHighlight = true;

	private statusBarEl: HTMLElement | null = null;
	private statusTimer = 0;
	private lastActiveMarkdownFile: TFile | null = null;
	private cleanups: Array<() => void> = [];
	private debouncedRefresh = debounce(() => this._refreshSidebar(), 200, true);

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new FootnoteMgrSettingTab(this.app, this));
		this.registerView(SIDEBAR_VIEW_TYPE, (leaf) => new FootnoteSidebarView(leaf, this));

		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.addClass('fm-status');

		this.addCommand({
			id: 'tidy-footnotes',
			name: 'Tidy footnotes in current note',
			callback: () => void this.runManualTidy(),
		});

		this.addCommand({
			id: 'show-footnote-sidebar',
			name: 'Show footnote sidebar',
			callback: () => void this.revealSidebar(),
		});

		this.addRibbonIcon('list-ordered', 'Footnote Manager: show footnotes', () => {
			void this.revealSidebar();
		});

		// Live Preview / Source clicks → sidebar highlight (never mutates the doc).
		this.registerEditorExtension(
			createEditorClickExtension((click, event) => this.onEditorClick(click, event)),
		);

		// Reading Mode clicks on a footnote reference → sidebar highlight.
		this.registerDomEvent(activeDocument, 'click', (evt) => this.onReadingClick(evt));

		// Keep the sidebar in sync with edits and file switches.
		this.registerEvent(this.app.workspace.on('editor-change', () => this.debouncedRefresh()));
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				this.updateLastActiveMarkdownFile(file);
				this._refreshSidebar();
				// Auto pass on open (only capabilities set to Automatic).
				window.setTimeout(() => this.tidyActiveEditor(true), 50);
			}),
		);

		// Manual save (Cmd/Ctrl+S) → auto pass. Uses an internal-command wrap
		// confined to the adapter; unpatched on unload.
		const unpatch = patchManualSave(this.app, () => this.tidyActiveEditor(true));
		this.cleanups.push(unpatch);

		// Recurring 2-minute auto pass while a note is active.
		this.registerInterval(window.setInterval(() => this.tidyActiveEditor(true), AUTO_INTERVAL_MS));

		this.app.workspace.onLayoutReady(() => {
			this.updateLastActiveMarkdownFile(this.app.workspace.getActiveFile());

			const button = addRightRibbonButton(
				this.app,
				'list-ordered',
				'Footnote Manager: show footnotes',
				() => void this.revealSidebar(),
				setIcon,
			);
			this.cleanups.push(button);

			if (this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE).length === 0) {
				const leaf = this.app.workspace.getRightLeaf(false);
				if (leaf) void leaf.setViewState({ type: SIDEBAR_VIEW_TYPE });
			}
			this._refreshSidebar();
		});
	}

	onunload(): void {
		for (const fn of this.cleanups) {
			try {
				fn();
			} catch {
				/* best-effort teardown */
			}
		}
		this.cleanups = [];
		window.clearTimeout(this.statusTimer);
	}

	async loadSettings(): Promise<void> {
		this.settings = migrateSettings(await this.loadData());
		this.showFull = this.settings.showFullByDefault;
		this.idxHighlight = this.settings.idxHighlightEnabled;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	// ── Active-file helpers ────────────────────────────────────────────────────

	private updateLastActiveMarkdownFile(file: TFile | null): void {
		if (file && file.extension === 'md') this.lastActiveMarkdownFile = file;
	}

	getActiveMarkdownFile(): TFile | null {
		const active = this.app.workspace.getActiveFile();
		return active && active.extension === 'md' ? active : this.lastActiveMarkdownFile;
	}

	// Current text of the active markdown note, or the last active one when focus
	// is on the sidebar. Read from the live editor buffer so the sidebar reflects
	// unsaved edits.
	private activeDocText(): string | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) return view.getViewData();

		const file = this.lastActiveMarkdownFile;
		if (!file) return null;
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path) {
				return leaf.view.getViewData();
			}
		}
		return null;
	}

	getSidebarEntries(): SidebarEntry[] {
		const text = this.activeDocText();
		if (text === null) return [];
		return sidebarEntriesFor(text, parseDelimiters(this.settings.excludedDelimiters));
	}

	// ── Sidebar plumbing ───────────────────────────────────────────────────────

	private getSidebarView(): FootnoteSidebarView | null {
		for (const leaf of this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)) {
			if (leaf.view instanceof FootnoteSidebarView) return leaf.view;
		}
		return null;
	}

	refreshSidebar(): void {
		this.debouncedRefresh();
	}

	private _refreshSidebar(): void {
		this.getSidebarView()?.render();
	}

	private async revealSidebar(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);
		if (existing.length && existing[0]) {
			await this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: SIDEBAR_VIEW_TYPE });
			await this.app.workspace.revealLeaf(leaf);
		}
	}

	toggleShowFull(): void {
		this.showFull = !this.showFull;
		this.settings.showFullByDefault = this.showFull;
		void this.saveSettings();
		this._refreshSidebar();
	}

	toggleIdx(): void {
		this.idxHighlight = !this.idxHighlight;
		this.settings.idxHighlightEnabled = this.idxHighlight;
		void this.saveSettings();
		this._refreshSidebar();
	}

	// ── Navigation ─────────────────────────────────────────────────────────────

	async jumpToOffset(offset: number): Promise<void> {
		const file = this.getActiveMarkdownFile();
		if (!file) return;

		const existing = this.app.workspace
			.getLeavesOfType('markdown')
			.find((l) => l.view instanceof MarkdownView && l.view.file?.path === file.path);

		let leaf: WorkspaceLeaf;
		if (existing) {
			leaf = existing;
			await this.app.workspace.revealLeaf(leaf);
		} else {
			leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}

		await new Promise<void>((r) => window.setTimeout(r, 50));

		const view = leaf.view;
		if (view instanceof MarkdownView) {
			const editor = view.editor;
			const pos = editor.offsetToPos(offset);
			editor.setCursor(pos);
			editor.scrollIntoView({ from: pos, to: pos }, true);
			editor.focus();
			view.setEphemeralState({ line: pos.line });
		}
	}

	// ── Index-click → sidebar highlight ────────────────────────────────────────

	private onEditorClick(click: EditorClick, _event: MouseEvent): boolean {
		if (!this.idxHighlight) return false;
		const label = refLabelAtOffset(
			click.docText,
			parseDelimiters(this.settings.excludedDelimiters),
			click.offset,
		);
		if (label) this.getSidebarView()?.highlight(label);
		// Additive: never consume the click, so normal editor behavior is intact.
		return false;
	}

	private onReadingClick(evt: MouseEvent): void {
		if (!this.idxHighlight) return;
		const el = closestFootnoteRef(evt.target);
		if (!el) return;

		const root = el.closest<HTMLElement>('.markdown-preview-view') ?? activeDocument.body;
		const index = footnoteRefIndexInRoot(el, root);
		if (index < 0) return;

		const text = this.activeDocText();
		if (text === null) return;
		const label = refLabelByIndex(text, parseDelimiters(this.settings.excludedDelimiters), index);
		if (label) this.getSidebarView()?.highlight(label);
	}

	// ── Tidy execution ─────────────────────────────────────────────────────────

	// Manual invocation (command palette / sidebar refresh button): runs every
	// enabled capability regardless of its manual-vs-automatic setting.
	async runManualTidy(): Promise<void> {
		this.tidyActiveEditor(false);
		this._refreshSidebar();
	}

	// Runs a tidy pass on the active markdown editor. `auto` selects between the
	// automatic subset (capabilities whose Automatic switch is on) and the full
	// manual set. Reading Mode is never mutated; edits go through a single editor
	// transaction so cursor, selection, scroll, and undo are preserved.
	private tidyActiveEditor(auto: boolean): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || view.getMode() === 'preview') return;

		const options = auto
			? {
					reindex: this.settings.reindexEnabled && this.settings.reindexAuto,
					consolidate: this.settings.consolidateEnabled && this.settings.consolidateAuto,
				}
			: {
					reindex: this.settings.reindexEnabled,
					consolidate: this.settings.consolidateEnabled,
				};
		if (!options.reindex && !options.consolidate) return;

		const editor = view.editor;
		const oldText = editor.getValue();
		const result = tidyDocument(oldText, toTidyConfig(this.settings), options);

		if (result.skipped) {
			// Only surface the skip Notice for explicit/manual runs to avoid noise
			// on every automatic pass.
			if (!auto) new Notice(`Footnote Manager: skipped — ${describeIssues(result.issues)}`);
			return;
		}
		if (!result.changed) {
			this.debouncedRefresh();
			return;
		}

		this.writeViaTransaction(editor, oldText, result.text);
		this.flashStatus();
		this.debouncedRefresh();
	}

	// The ONLY document write path: a single Obsidian Editor transaction. No
	// vault.modify / editor.setValue writes exist anywhere in the plugin.
	private writeViaTransaction(editor: Editor, oldText: string, newText: string): void {
		const cursorOffset = editor.posToOffset(editor.getCursor());
		const scroll = editor.getScrollInfo();
		editor.transaction({
			changes: [{ from: { line: 0, ch: 0 }, to: editor.offsetToPos(oldText.length), text: newText }],
			selection: { from: editor.offsetToPos(Math.min(cursorOffset, newText.length)) },
		});
		editor.scrollTo(scroll.left, scroll.top);
	}

	private flashStatus(message = 'Footnotes tidied'): void {
		if (!this.statusBarEl) return;
		this.statusBarEl.setText(message);
		window.clearTimeout(this.statusTimer);
		this.statusTimer = window.setTimeout(() => this.statusBarEl?.setText(''), STATUS_CLEAR_MS);
	}
}
