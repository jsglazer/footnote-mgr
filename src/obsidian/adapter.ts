import { App } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

// ── Undocumented Obsidian internals — confined to this single module ─────────
// Targeted against Obsidian 1.12.7 (the installed version at build time). If a
// future Obsidian release changes any of these shapes, this is the only file to
// fix. Every access is guarded so a mismatch degrades gracefully instead of
// throwing. Core logic never imports from here.

interface InternalCommand {
	callback?: () => void;
}

interface CommandsInternals {
	commands?: Record<string, InternalCommand | undefined>;
}

interface RibbonContainer {
	containerEl?: HTMLElement;
}

interface WorkspaceInternals {
	rightRibbon?: RibbonContainer;
	rightSplit?: RibbonContainer;
}

// Obsidian exposes no public "manual save" event. Cmd/Ctrl+S runs the built-in
// `editor:save-file` command, so we wrap its callback to also run our auto tidy
// pass. Returns an unpatch function that restores the original callback; it is
// registered for cleanup in onunload.
export function patchManualSave(app: App, onSave: () => void): () => void {
	const commands = (app as unknown as { commands?: CommandsInternals }).commands;
	const cmd = commands?.commands?.['editor:save-file'];
	if (!cmd) return () => undefined;

	const original = cmd.callback;
	cmd.callback = () => {
		original?.();
		onSave();
	};
	return () => {
		cmd.callback = original;
	};
}

// Inject an action button into Obsidian's right ribbon, mirroring the approach
// annotation-manager uses. Tries the internal rightRibbon, then a DOM query,
// then the right split container, and returns a remove function.
export function addRightRibbonButton(
	app: App,
	icon: string,
	label: string,
	onClick: () => void,
	setIcon: (el: HTMLElement, icon: string) => void,
): () => void {
	const internals = app.workspace as unknown as WorkspaceInternals;

	const make = (parent: HTMLElement, cls: string): HTMLElement => {
		const btn = parent.createEl('div', {
			cls,
			attr: { 'aria-label': label, title: label },
		});
		setIcon(btn, icon);
		btn.addEventListener('click', onClick);
		return btn;
	};

	try {
		const rightRibbon = internals.rightRibbon;
		if (rightRibbon?.containerEl) {
			const btn = make(rightRibbon.containerEl, 'side-dock-ribbon-action');
			return () => btn.remove();
		}
	} catch {
		/* fall through */
	}

	try {
		const ribbonEl = activeDocument.querySelector<HTMLElement>('.workspace-ribbon.mod-right');
		if (ribbonEl) {
			const btn = make(ribbonEl, 'side-dock-ribbon-action');
			return () => btn.remove();
		}
	} catch {
		/* fall through */
	}

	try {
		const containerEl = internals.rightSplit?.containerEl;
		if (containerEl) {
			const btn = make(containerEl, 'fm-right-panel-btn');
			return () => btn.remove();
		}
	} catch {
		/* give up */
	}

	return () => undefined;
}

// Reading Mode markup: Obsidian renders each footnote reference as an anchor
// carrying the `footnote-ref` class. The class is the only internal detail, so
// it lives here.
const FOOTNOTE_REF_SELECTOR = 'a.footnote-ref, sup.footnote-ref, .footnote-ref';

// Closest footnote-reference element to a clicked node, or null.
export function closestFootnoteRef(target: EventTarget | null): HTMLElement | null {
	if (!(target instanceof HTMLElement)) return null;
	return target.closest<HTMLElement>(FOOTNOTE_REF_SELECTOR);
}

// 0-based index of `el` among all footnote-reference anchors inside `root`
// (document order), or -1. Obsidian renders references in document order, so
// this index maps directly onto the Nth parsed reference.
export function footnoteRefIndexInRoot(el: HTMLElement, root: HTMLElement): number {
	const all = Array.from(root.querySelectorAll<HTMLElement>(FOOTNOTE_REF_SELECTOR));
	return all.indexOf(el);
}

export interface EditorClick {
	docText: string;
	offset: number;
}

// A CodeMirror 6 extension that reports Live Preview / Source mousedown clicks
// as document offsets. The handler returns true to consume the click (used to
// suppress the native footnote jump when highlighting the sidebar instead).
export function createEditorClickExtension(
	handler: (click: EditorClick, event: MouseEvent) => boolean,
): Extension {
	return EditorView.domEventHandlers({
		mousedown: (event, view) => {
			const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
			if (pos == null) return false;
			const consumed = handler({ docText: view.state.doc.toString(), offset: pos }, event);
			if (consumed) {
				event.preventDefault();
				return true;
			}
			return false;
		},
	});
}
