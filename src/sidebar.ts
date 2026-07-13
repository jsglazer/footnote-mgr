import { ItemView, WorkspaceLeaf } from 'obsidian';
import type FootnoteMgrPlugin from './main';
import { SidebarEntry } from './core/sidebarModel';
import { highlightColors } from './settings';

export const SIDEBAR_VIEW_TYPE = 'footnote-mgr-sidebar';

// The right-panel footnote list. Rendering is display-only; every jump target
// and label comes from the pure core (SidebarEntry). Clicking a row's number
// jumps to the reference (the index entry) in the document; clicking its body
// jumps to the definition. The bottom control row mirrors the command palette.
export class FootnoteSidebarView extends ItemView {
	private plugin: FootnoteMgrPlugin;
	private rowsByLabel = new Map<string, HTMLElement>();
	private highlighted: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: FootnoteMgrPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return SIDEBAR_VIEW_TYPE;
	}
	getDisplayText(): string {
		return 'Footnotes';
	}
	getIcon(): string {
		return 'list-ordered';
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	render(): void {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass('fm-sidebar');
		this.rowsByLabel.clear();

		root.createEl('div', { text: 'Footnotes', cls: 'fm-sidebar-title' });

		const file = this.plugin.getActiveMarkdownFile();
		if (!file) {
			root.createEl('p', { text: 'Open a note to see its footnotes.', cls: 'fm-sidebar-empty' });
			this.renderControls(root);
			return;
		}

		const entries = this.plugin.getSidebarEntries();
		if (entries.length === 0) {
			root.createEl('p', { text: 'No footnotes in this note.', cls: 'fm-sidebar-empty' });
			this.renderControls(root);
			return;
		}

		const list = root.createDiv('fm-sidebar-list');
		for (const entry of entries) this.renderRow(list, entry);

		this.renderControls(root);
	}

	private renderRow(list: HTMLElement, entry: SidebarEntry): void {
		const row = list.createDiv('fm-row');
		row.dataset.label = entry.label;
		this.rowsByLabel.set(entry.label, row);

		const num = row.createEl('button', { text: entry.label, cls: 'fm-num' });
		num.setAttr('title', 'Jump to the reference in the note');
		if (entry.firstRefOffset !== null) {
			const offset = entry.firstRefOffset;
			num.addEventListener('click', () => void this.plugin.jumpToOffset(offset));
		} else {
			num.addClass('fm-num-orphan');
			num.setAttr('title', 'This footnote has no reference in the note');
		}

		const body = row.createDiv('fm-body');
		body.setAttr('title', 'Jump to the definition in the note');
		this.renderBody(body, entry.content);
		if (entry.defOffset !== null) {
			const offset = entry.defOffset;
			body.addEventListener('click', () => void this.plugin.jumpToOffset(offset));
		} else {
			body.addClass('fm-body-empty');
			body.setText('(No definition)');
		}
	}

	private renderBody(body: HTMLElement, content: string): void {
		const lines = content.split('\n');
		const showFull = this.plugin.showFull;
		const max = Math.max(1, this.plugin.settings.maxLines);
		const shown = showFull ? lines : lines.slice(0, max);
		for (const line of shown) body.createDiv({ text: line, cls: 'fm-body-line' });
		if (!showFull && lines.length > max) {
			body.createDiv({ text: '…', cls: 'fm-body-more' });
		}
	}

	private renderControls(root: HTMLElement): void {
		const controls = root.createDiv('fm-controls');

		const refresh = controls.createEl('button', { text: 'Refresh', cls: 'fm-ctrl-btn' });
		refresh.setAttr('title', 'Tidy footnotes (consolidate + re-index) and refresh this list');
		refresh.addEventListener('click', () => void this.plugin.runManualTidy());

		const full = controls.createEl('button', {
			text: 'Full',
			cls: 'fm-ctrl-btn' + (this.plugin.showFull ? ' fm-ctrl-btn-on' : ''),
		});
		full.setAttr('title', 'Show the entire text of every footnote');
		full.addEventListener('click', () => this.plugin.toggleShowFull());

		const idx = controls.createEl('button', {
			text: 'Idx',
			cls: 'fm-ctrl-btn' + (this.plugin.idxHighlight ? ' fm-ctrl-btn-on' : ''),
		});
		idx.setAttr('title', 'Highlight a footnote here when its index is clicked in the note');
		idx.addEventListener('click', () => this.plugin.toggleIdx());
	}

	// Highlight the row for `label` (clearing any prior highlight) and scroll it
	// into view. Called when a reference is clicked in the document with Idx on.
	highlight(label: string): void {
		this.clearHighlight();
		const row = this.rowsByLabel.get(label);
		if (!row) return;
		const c = highlightColors(this.plugin.settings.highlightStyle);
		row.addClass('fm-row-highlight');
		row.setCssStyles({ color: c.fontColor, backgroundColor: c.backgroundColor });
		row.scrollIntoView({ block: 'center', behavior: 'smooth' });
		this.highlighted = label;
	}

	private clearHighlight(): void {
		if (this.highlighted === null) return;
		const prev = this.rowsByLabel.get(this.highlighted);
		if (prev) {
			prev.removeClass('fm-row-highlight');
			prev.setCssStyles({ color: '', backgroundColor: '' });
		}
		this.highlighted = null;
	}
}
