var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FootnoteMgrPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");

// src/util.ts
function isDarkTheme() {
  return activeDocument.body.classList.contains("theme-dark");
}

// src/settings.ts
function colorOption(color = "") {
  return { enabled: color !== "", color };
}
function themeStyle(fr, bg) {
  return { fr: colorOption(fr), bg: colorOption(bg) };
}
var FENCED_CODE_DELIMITER = "```";
function defaultSettings() {
  return {
    reindexEnabled: true,
    reindexAuto: false,
    consolidateEnabled: true,
    consolidateAuto: false,
    consolidateTarget: "end",
    consolidateHeadingText: "Footnotes",
    consolidateHeadingLevel: 2,
    excludedDelimiters: FENCED_CODE_DELIMITER,
    maxLines: 3,
    showFullByDefault: false,
    idxHighlightEnabled: true,
    highlightStyle: {
      light: themeStyle("", "#fff3a0"),
      dark: themeStyle("", "#4d4a1f")
    }
  };
}
function toConsolidateConfig(s) {
  return {
    target: s.consolidateTarget,
    headingText: s.consolidateHeadingText,
    headingLevel: s.consolidateHeadingLevel
  };
}
function toTidyConfig(s) {
  return { delimiters: s.excludedDelimiters, consolidate: toConsolidateConfig(s) };
}
function asRecord(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? v : null;
}
function readString(v, fallback) {
  return typeof v === "string" ? v : fallback;
}
function readBool(v, fallback) {
  return typeof v === "boolean" ? v : fallback;
}
function readColorOption(v) {
  const r = asRecord(v);
  if (!r) return colorOption();
  return { enabled: r.enabled === true, color: readString(r.color, "") };
}
function readThemeStyle(v, fallback) {
  const r = asRecord(v);
  if (!r) return fallback;
  return { fr: readColorOption(r.fr), bg: readColorOption(r.bg) };
}
function migrateSettings(raw) {
  const s = defaultSettings();
  const r = asRecord(raw);
  if (!r) return s;
  s.reindexEnabled = readBool(r.reindexEnabled, s.reindexEnabled);
  s.reindexAuto = readBool(r.reindexAuto, s.reindexAuto);
  s.consolidateEnabled = readBool(r.consolidateEnabled, s.consolidateEnabled);
  s.consolidateAuto = readBool(r.consolidateAuto, s.consolidateAuto);
  s.consolidateTarget = r.consolidateTarget === "heading" ? "heading" : "end";
  s.consolidateHeadingText = readString(r.consolidateHeadingText, s.consolidateHeadingText);
  if (typeof r.consolidateHeadingLevel === "number") {
    s.consolidateHeadingLevel = clampLevel(r.consolidateHeadingLevel);
  }
  s.excludedDelimiters = readString(r.excludedDelimiters, s.excludedDelimiters);
  if (typeof r.maxLines === "number" && Number.isFinite(r.maxLines)) {
    s.maxLines = Math.max(1, Math.floor(r.maxLines));
  }
  s.showFullByDefault = readBool(r.showFullByDefault, s.showFullByDefault);
  s.idxHighlightEnabled = readBool(r.idxHighlightEnabled, s.idxHighlightEnabled);
  const hs = asRecord(r.highlightStyle);
  if (hs) {
    s.highlightStyle = {
      light: readThemeStyle(hs.light, s.highlightStyle.light),
      dark: readThemeStyle(hs.dark, s.highlightStyle.dark)
    };
  }
  return s;
}
function clampLevel(n) {
  return Math.min(6, Math.max(1, Math.floor(n)));
}
function isValidHex(s) {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}
function normalizeHex(value) {
  const v = value.trim();
  if (!v) return "";
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^[0-9a-fA-F]{6}$/.test(v)) return "#" + v;
  return "";
}
function highlightColors(style) {
  const theme = isDarkTheme() ? "dark" : "light";
  const t = style[theme];
  return {
    fontColor: t.fr.enabled ? t.fr.color : "",
    backgroundColor: t.bg.enabled ? t.bg.color : ""
  };
}
var FootnoteMgrSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("fm-settings-tab");
    containerEl.createDiv({
      cls: "fm-settings-version",
      text: `Footnote Manager v${this.plugin.manifest.version}`
    });
    this.renderInfoPanel(containerEl);
    this.renderReindexSection(containerEl);
    this.renderConsolidateSection(containerEl);
    this.renderParserSection(containerEl);
    this.renderSidebarSection(containerEl);
    this.renderHighlightSection(containerEl);
  }
  async save() {
    await this.plugin.saveSettings();
    this.plugin.refreshSidebar();
  }
  renderInfoPanel(containerEl) {
    const infoPanel = containerEl.createDiv({ cls: "fm-info-panel" });
    const p = infoPanel.createEl("p");
    p.appendText(
      "Automatic passes run on file open, on manual save (Cmd/Ctrl+S), and every 2 minutes while a note is active \u2014 only for capabilities set to Automatic. Notes with orphaned references, unreferenced definitions, or duplicate labels are skipped so nothing is lost."
    );
  }
  renderReindexSection(containerEl) {
    new import_obsidian.Setting(containerEl).setName("Re-indexing").setHeading();
    this.renderToggle(
      containerEl,
      "Enable re-indexing",
      "Renumber numeric footnotes to run 1, 2, 3, \u2026 by first reference. Named footnotes are left untouched.",
      () => this.plugin.settings.reindexEnabled,
      (v) => this.plugin.settings.reindexEnabled = v
    );
    this.renderToggle(
      containerEl,
      "Automatic re-indexing",
      "Run re-indexing automatically on the triggers above (otherwise it runs only from the command or the sidebar refresh button).",
      () => this.plugin.settings.reindexAuto,
      (v) => this.plugin.settings.reindexAuto = v
    );
  }
  renderConsolidateSection(containerEl) {
    new import_obsidian.Setting(containerEl).setName("Consolidation").setHeading();
    this.renderToggle(
      containerEl,
      "Enable consolidation",
      "Gather all footnote definitions into one place, ordered by first reference.",
      () => this.plugin.settings.consolidateEnabled,
      (v) => this.plugin.settings.consolidateEnabled = v
    );
    this.renderToggle(
      containerEl,
      "Automatic consolidation",
      "Run consolidation automatically on the triggers above (otherwise it runs only from the command or the sidebar refresh button).",
      () => this.plugin.settings.consolidateAuto,
      (v) => this.plugin.settings.consolidateAuto = v
    );
    new import_obsidian.Setting(containerEl).setName("Consolidation destination").setDesc("Where consolidated definitions are written.").addDropdown(
      (dd) => dd.addOption("end", "End of document").addOption("heading", "Under a heading").setValue(this.plugin.settings.consolidateTarget).onChange(async (v) => {
        this.plugin.settings.consolidateTarget = v === "heading" ? "heading" : "end";
        await this.save();
        this.display();
      })
    );
    if (this.plugin.settings.consolidateTarget === "heading") {
      new import_obsidian.Setting(containerEl).setName("Heading text").setDesc("The heading under which definitions are collected (created if absent).").addText(
        (text) => text.setPlaceholder("Footnotes").setValue(this.plugin.settings.consolidateHeadingText).onChange(async (v) => {
          this.plugin.settings.consolidateHeadingText = v;
          await this.save();
        })
      );
      new import_obsidian.Setting(containerEl).setName("Heading level").setDesc("The Markdown heading level (1-6) to match and create.").addDropdown((dd) => {
        for (let i = 1; i <= 6; i++) dd.addOption(String(i), `${"#".repeat(i)} (H${i})`);
        dd.setValue(String(this.plugin.settings.consolidateHeadingLevel)).onChange(async (v) => {
          this.plugin.settings.consolidateHeadingLevel = clampLevel(Number(v));
          await this.save();
        });
      });
    }
  }
  renderParserSection(containerEl) {
    new import_obsidian.Setting(containerEl).setName("Parser exclusions").setHeading();
    containerEl.createEl("p", {
      text: "One delimiter pair per line. A single token is a symmetric delimiter (e.g. ``` or $$ or $); two tokens are an open/close pair (e.g. <!-- -->). Footnotes inside any listed region are ignored.",
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(containerEl).setClass("fm-delimiter-setting").addTextArea((ta) => {
      ta.setValue(this.plugin.settings.excludedDelimiters).onChange(async (v) => {
        this.plugin.settings.excludedDelimiters = v;
        await this.save();
      });
      ta.inputEl.rows = 5;
      ta.inputEl.addClass("fm-delimiter-input");
    });
  }
  renderSidebarSection(containerEl) {
    new import_obsidian.Setting(containerEl).setName("Sidebar").setHeading();
    new import_obsidian.Setting(containerEl).setName("Maximum lines per footnote").setDesc("How many lines of each footnote to show before it is truncated (the Full button overrides this).").addSlider(
      (sl) => sl.setLimits(1, 20, 1).setValue(this.plugin.settings.maxLines).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.maxLines = v;
        await this.save();
      })
    );
    this.renderToggle(
      containerEl,
      "Show full footnotes by default",
      "Start with every footnote expanded in the sidebar (the same as pressing Full).",
      () => this.plugin.settings.showFullByDefault,
      (v) => {
        this.plugin.settings.showFullByDefault = v;
        this.plugin.showFull = v;
      }
    );
    this.renderToggle(
      containerEl,
      "Highlight on index click",
      "Clicking a footnote reference in the document highlights the matching footnote in the sidebar (the same as the Idx button).",
      () => this.plugin.settings.idxHighlightEnabled,
      (v) => {
        this.plugin.settings.idxHighlightEnabled = v;
        this.plugin.idxHighlight = v;
      }
    );
  }
  renderHighlightSection(containerEl) {
    new import_obsidian.Setting(containerEl).setName("Highlight colors").setHeading();
    containerEl.createEl("p", {
      text: "Colors used to highlight a footnote in the sidebar when its index is clicked. Fr = text color, Bg = background; each checkbox controls whether that color is applied.",
      cls: "setting-item-description"
    });
    this.renderHighlightGrid(containerEl);
  }
  renderHighlightGrid(containerEl) {
    const style = this.plugin.settings.highlightStyle;
    const wrap = containerEl.createDiv("fm-grid-wrap");
    const table = wrap.createEl("table", { cls: "fm-grid-table" });
    const thead = table.createEl("thead");
    const r1 = thead.createEl("tr");
    r1.createEl("th", { text: "Light", attr: { colspan: "2" } });
    r1.createEl("th", { text: "Dark", attr: { colspan: "2" }, cls: "fm-grid-sep" });
    r1.createEl("th", { text: "Example", attr: { rowspan: "2" }, cls: "fm-grid-sep" });
    const r2 = thead.createEl("tr");
    r2.createEl("th", { text: "Fr" });
    r2.createEl("th", { text: "Bg" });
    r2.createEl("th", { text: "Fr", cls: "fm-grid-sep" });
    r2.createEl("th", { text: "Bg" });
    const tbody = table.createEl("tbody");
    const tr = tbody.createEl("tr");
    let exampleTd = null;
    const refreshExample = () => {
      if (!exampleTd) return;
      exampleTd.empty();
      const c = highlightColors(style);
      const chip = exampleTd.createEl("span", { text: "Footnote", cls: "fm-grid-example-chip" });
      chip.setCssStyles({ color: c.fontColor, backgroundColor: c.backgroundColor });
    };
    for (const theme of ["light", "dark"]) {
      for (const field of ["fr", "bg"]) {
        const td = tr.createEl("td", {
          cls: theme === "dark" && field === "fr" ? "fm-grid-sep" : ""
        });
        this.renderColorCell(td, style[theme][field], refreshExample);
      }
    }
    exampleTd = tr.createEl("td", { cls: "fm-grid-example fm-grid-sep" });
    refreshExample();
  }
  // One cell bound to a ColorOption: a checkbox, a swatch (native picker), and
  // an editable hex field — same idiom as annotation-manager. Setting a color by
  // either control auto-enables the checkbox; the checkbox alone toggles whether
  // the stored color is applied.
  renderColorCell(td, opt, onChanged) {
    const wrap = td.createDiv("fm-grid-cell");
    const check = wrap.createEl("input", { attr: { type: "checkbox" }, cls: "fm-grid-check" });
    check.checked = opt.enabled;
    const picker = wrap.createEl("input", { attr: { type: "color" }, cls: "fm-grid-color" });
    picker.value = isValidHex(opt.color) ? opt.color : "#888888";
    const hex = wrap.createEl("input", {
      cls: "fm-grid-hex",
      attr: { type: "text", maxlength: "7", placeholder: "#hex", spellcheck: "false" }
    });
    hex.value = isValidHex(opt.color) ? opt.color : "";
    const autoEnable = () => {
      if (!opt.enabled) {
        opt.enabled = true;
        check.checked = true;
      }
    };
    check.addEventListener("change", () => {
      opt.enabled = check.checked;
      if (opt.enabled && !isValidHex(opt.color)) {
        opt.color = picker.value;
        hex.value = picker.value;
      }
      void this.save();
      onChanged();
    });
    picker.addEventListener("input", () => {
      opt.color = picker.value;
      hex.value = picker.value;
      autoEnable();
      onChanged();
    });
    picker.addEventListener("change", () => {
      opt.color = picker.value;
      hex.value = picker.value;
      autoEnable();
      void this.save();
      onChanged();
    });
    hex.addEventListener("input", () => {
      const norm = normalizeHex(hex.value);
      if (!norm) return;
      opt.color = norm;
      picker.value = norm;
      autoEnable();
      onChanged();
    });
    hex.addEventListener("change", () => {
      const norm = normalizeHex(hex.value);
      if (norm) {
        hex.value = norm;
        opt.color = norm;
        picker.value = norm;
        autoEnable();
        void this.save();
        onChanged();
      } else {
        hex.value = isValidHex(opt.color) ? opt.color : "";
      }
    });
  }
  renderToggle(containerEl, name, desc, getValue, setValue) {
    new import_obsidian.Setting(containerEl).setName(name).setDesc(desc).addToggle(
      (toggle) => toggle.setValue(getValue()).onChange(async (v) => {
        setValue(v);
        await this.save();
      })
    );
  }
};

// src/sidebar.ts
var import_obsidian2 = require("obsidian");
var SIDEBAR_VIEW_TYPE = "footnote-mgr-sidebar";
var FootnoteSidebarView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.rowsByLabel = /* @__PURE__ */ new Map();
    this.highlighted = null;
    this.plugin = plugin;
  }
  getViewType() {
    return SIDEBAR_VIEW_TYPE;
  }
  getDisplayText() {
    return "Footnotes";
  }
  getIcon() {
    return "list-ordered";
  }
  async onOpen() {
    this.render();
  }
  render() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("fm-sidebar");
    this.rowsByLabel.clear();
    root.createEl("div", { text: "Footnotes", cls: "fm-sidebar-title" });
    const file = this.plugin.getActiveMarkdownFile();
    if (!file) {
      root.createEl("p", { text: "Open a note to see its footnotes.", cls: "fm-sidebar-empty" });
      this.renderControls(root);
      return;
    }
    const entries = this.plugin.getSidebarEntries();
    if (entries.length === 0) {
      root.createEl("p", { text: "No footnotes in this note.", cls: "fm-sidebar-empty" });
      this.renderControls(root);
      return;
    }
    const list = root.createDiv("fm-sidebar-list");
    for (const entry of entries) this.renderRow(list, entry);
    this.renderControls(root);
  }
  renderRow(list, entry) {
    const row = list.createDiv("fm-row");
    row.dataset.label = entry.label;
    this.rowsByLabel.set(entry.label, row);
    const num = row.createEl("button", { text: entry.label, cls: "fm-num" });
    num.setAttr("title", "Jump to the reference in the note");
    if (entry.firstRefOffset !== null) {
      const offset = entry.firstRefOffset;
      num.addEventListener("click", () => void this.plugin.jumpToOffset(offset));
    } else {
      num.addClass("fm-num-orphan");
      num.setAttr("title", "This footnote has no reference in the note");
    }
    const body = row.createDiv("fm-body");
    body.setAttr("title", "Jump to the definition in the note");
    this.renderBody(body, entry.content);
    if (entry.defOffset !== null) {
      const offset = entry.defOffset;
      body.addEventListener("click", () => void this.plugin.jumpToOffset(offset));
    } else {
      body.addClass("fm-body-empty");
      body.setText("(No definition)");
    }
  }
  renderBody(body, content) {
    const lines = content.split("\n");
    const showFull = this.plugin.showFull;
    const max = Math.max(1, this.plugin.settings.maxLines);
    const shown = showFull ? lines : lines.slice(0, max);
    for (const line of shown) body.createDiv({ text: line, cls: "fm-body-line" });
    if (!showFull && lines.length > max) {
      body.createDiv({ text: "\u2026", cls: "fm-body-more" });
    }
  }
  renderControls(root) {
    const controls = root.createDiv("fm-controls");
    const refresh = controls.createEl("button", { text: "Refresh", cls: "fm-ctrl-btn" });
    refresh.setAttr("title", "Tidy footnotes (consolidate + re-index) and refresh this list");
    refresh.addEventListener("click", () => void this.plugin.runManualTidy());
    const full = controls.createEl("button", {
      text: "Full",
      cls: "fm-ctrl-btn" + (this.plugin.showFull ? " fm-ctrl-btn-on" : "")
    });
    full.setAttr("title", "Show the entire text of every footnote");
    full.addEventListener("click", () => this.plugin.toggleShowFull());
    const idx = controls.createEl("button", {
      text: "Idx",
      cls: "fm-ctrl-btn" + (this.plugin.idxHighlight ? " fm-ctrl-btn-on" : "")
    });
    idx.setAttr("title", "Highlight a footnote here when its index is clicked in the note");
    idx.addEventListener("click", () => this.plugin.toggleIdx());
  }
  // Highlight the row for `label` (clearing any prior highlight) and scroll it
  // into view. Called when a reference is clicked in the document with Idx on.
  highlight(label) {
    this.clearHighlight();
    const row = this.rowsByLabel.get(label);
    if (!row) return;
    const c = highlightColors(this.plugin.settings.highlightStyle);
    row.addClass("fm-row-highlight");
    row.setCssStyles({ color: c.fontColor, backgroundColor: c.backgroundColor });
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    this.highlighted = label;
  }
  clearHighlight() {
    if (this.highlighted === null) return;
    const prev = this.rowsByLabel.get(this.highlighted);
    if (prev) {
      prev.removeClass("fm-row-highlight");
      prev.setCssStyles({ color: "", backgroundColor: "" });
    }
    this.highlighted = null;
  }
};

// src/core/delimiters.ts
function parseDelimiters(config) {
  const pairs = [];
  for (const rawLine of config.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const tokens = line.split(/\s+/);
    const open = tokens[0];
    if (!open) continue;
    const close = tokens.length >= 2 ? tokens[1] : open;
    pairs.push({ open, close });
  }
  return pairs;
}
function buildMasks(text, pairs) {
  const masks = [];
  if (pairs.length === 0) return masks;
  const sorted = [...pairs].sort((a, b) => b.open.length - a.open.length);
  const n = text.length;
  let i = 0;
  while (i < n) {
    let matched = null;
    for (const p of sorted) {
      if (p.open.length > 0 && text.startsWith(p.open, i)) {
        matched = p;
        break;
      }
    }
    if (!matched) {
      i++;
      continue;
    }
    const contentStart = i + matched.open.length;
    const closeIdx = text.indexOf(matched.close, contentStart);
    if (closeIdx === -1) {
      masks.push({ start: i, end: n });
      break;
    }
    const end = closeIdx + matched.close.length;
    masks.push({ start: i, end });
    i = end;
  }
  return masks;
}
function isMasked(offset, masks) {
  for (const m of masks) {
    if (offset >= m.start && offset < m.end) return true;
  }
  return false;
}

// src/core/lines.ts
function splitLinesWithOffsets(text) {
  const lines = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === "\n") {
      lines.push({ text: text.slice(start, i), start });
      start = i + 1;
    }
  }
  return lines;
}
function lineStartOffsets(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}
function offsetToLine(offset, starts) {
  for (let i = starts.length - 1; i >= 0; i--) {
    if (offset >= starts[i]) return i;
  }
  return 0;
}
function isBlank(line) {
  return /^\s*$/.test(line);
}
function isIndented(line) {
  return /^(\t| {4,})/.test(line);
}
function dedent(line) {
  if (line.startsWith("	")) return line.slice(1);
  const m = /^ {1,4}/.exec(line);
  return m ? line.slice(m[0].length) : line;
}

// src/core/tokenizer.ts
var REF_PATTERN = /\[\^([^\]\s]+)\]/g;
var DEF_LINE = /^( {0,3})\[\^([^\]\s]+)\]:/;
function parseFootnotes(text, pairs) {
  const masks = buildMasks(text, pairs);
  const starts = lineStartOffsets(text);
  const defs = parseDefinitions(text, masks);
  const refs = parseReferences(text, masks, starts);
  return { refs, defs, masks };
}
function parseDefinitions(text, masks) {
  var _a;
  const lines = splitLinesWithOffsets(text);
  const defs = [];
  let li = 0;
  while (li < lines.length) {
    const line = lines[li];
    if (!line) {
      li++;
      continue;
    }
    const m = DEF_LINE.exec(line.text);
    if (!m) {
      li++;
      continue;
    }
    const indent = ((_a = m[1]) != null ? _a : "").length;
    const bracketOffset = line.start + indent;
    if (isMasked(bracketOffset, masks)) {
      li++;
      continue;
    }
    const label = m[2];
    const firstLineRest = line.text.slice(m[0].length);
    const contentLines = [firstLineRest.replace(/^ /, "")];
    let committed = li;
    let pendingBlanks = [];
    let j = li + 1;
    for (; j < lines.length; j++) {
      const next = lines[j];
      if (!next) break;
      if (isBlank(next.text)) {
        pendingBlanks.push(j);
        continue;
      }
      if (isIndented(next.text)) {
        for (let k = 0; k < pendingBlanks.length; k++) contentLines.push("");
        pendingBlanks = [];
        contentLines.push(dedent(next.text));
        committed = j;
        continue;
      }
      break;
    }
    const lastLine = lines[committed];
    const end = lastLine.start + lastLine.text.length;
    defs.push({
      label,
      start: bracketOffset,
      end,
      line: li,
      content: contentLines.join("\n").replace(/\s+$/, ""),
      raw: text.slice(bracketOffset, end)
    });
    li = committed + 1;
  }
  return defs;
}
function parseReferences(text, masks, starts) {
  const refs = [];
  REF_PATTERN.lastIndex = 0;
  let m;
  while ((m = REF_PATTERN.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (isMasked(start, masks)) continue;
    if (isDefinitionHead(text, start, end)) continue;
    refs.push({
      label: m[1],
      start,
      end,
      line: offsetToLine(start, starts)
    });
  }
  return refs;
}
function isDefinitionHead(text, start, end) {
  if (text[end] !== ":") return false;
  let spaces = 0;
  for (let j = start - 1; j >= 0; j--) {
    const ch = text[j];
    if (ch === "\n") break;
    if (ch === " ") {
      spaces++;
      continue;
    }
    return false;
  }
  return spaces <= 3;
}

// src/core/validate.ts
function validateFootnotes(parsed) {
  var _a;
  const issues = [];
  const defCounts = /* @__PURE__ */ new Map();
  for (const d of parsed.defs) defCounts.set(d.label, ((_a = defCounts.get(d.label)) != null ? _a : 0) + 1);
  const refLabels = /* @__PURE__ */ new Set();
  for (const r of parsed.refs) refLabels.add(r.label);
  for (const [label, count] of defCounts) {
    if (count > 1) issues.push({ type: "duplicate-def", label });
  }
  const reportedOrphan = /* @__PURE__ */ new Set();
  for (const r of parsed.refs) {
    if (!defCounts.has(r.label) && !reportedOrphan.has(r.label)) {
      reportedOrphan.add(r.label);
      issues.push({ type: "orphan-ref", label: r.label });
    }
  }
  for (const label of defCounts.keys()) {
    if (!refLabels.has(label)) issues.push({ type: "unreferenced-def", label });
  }
  return { ok: issues.length === 0, issues };
}
function describeIssues(issues) {
  const parts = issues.map((i) => {
    switch (i.type) {
      case "orphan-ref":
        return `reference [^${i.label}] has no definition`;
      case "unreferenced-def":
        return `definition [^${i.label}] is never referenced`;
      case "duplicate-def":
        return `definition [^${i.label}] is defined more than once`;
    }
  });
  return parts.join("; ");
}

// src/core/reindex.ts
var NUMERIC = /^\d+$/;
function reindexDocument(text, pairs) {
  const parsed = parseFootnotes(text, pairs);
  if (!validateFootnotes(parsed).ok) return { text, changed: false };
  const order = [];
  const seen = /* @__PURE__ */ new Set();
  for (const r of parsed.refs) {
    if (NUMERIC.test(r.label) && !seen.has(r.label)) {
      seen.add(r.label);
      order.push(r.label);
    }
  }
  const remap = /* @__PURE__ */ new Map();
  order.forEach((label, i) => remap.set(label, String(i + 1)));
  const edits = [];
  for (const r of parsed.refs) {
    const next = remap.get(r.label);
    if (next !== void 0 && next !== r.label) {
      edits.push({ start: r.start, end: r.end, text: `[^${next}]` });
    }
  }
  for (const d of parsed.defs) {
    const next = remap.get(d.label);
    if (next !== void 0 && next !== d.label) {
      const tokenEnd = d.start + 2 + d.label.length + 1;
      edits.push({ start: d.start, end: tokenEnd, text: `[^${next}]` });
    }
  }
  if (edits.length === 0) return { text, changed: false };
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return { text: out, changed: out !== text };
}

// src/core/docutil.ts
function removeRanges(text, ranges) {
  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  let out = text;
  for (const r of sorted) {
    out = out.slice(0, r.start) + out.slice(r.end);
  }
  return out;
}
function normalizeBlankLines(text) {
  const lines = splitLinesWithOffsets(text).map((l) => l.text);
  const out = [];
  let prevBlank = false;
  for (const line of lines) {
    const blank = isBlank(line);
    if (blank) {
      if (!prevBlank && out.length > 0) out.push("");
      prevBlank = true;
    } else {
      out.push(line);
      prevBlank = false;
    }
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

// src/core/consolidate.ts
function consolidateDocument(text, pairs, config) {
  const parsed = parseFootnotes(text, pairs);
  if (!validateFootnotes(parsed).ok) return { text, changed: false };
  if (parsed.defs.length === 0) return { text, changed: false };
  const firstRef = /* @__PURE__ */ new Map();
  parsed.refs.forEach((r, i) => {
    if (!firstRef.has(r.label)) firstRef.set(r.label, i);
  });
  const ordered = [...parsed.defs].sort(
    (a, b) => {
      var _a, _b;
      return ((_a = firstRef.get(a.label)) != null ? _a : 0) - ((_b = firstRef.get(b.label)) != null ? _b : 0);
    }
  );
  const defsBlock = ordered.map((d) => d.raw).join("\n\n");
  const body = normalizeBlankLines(
    removeRanges(
      text,
      parsed.defs.map((d) => ({ start: d.start, end: d.end }))
    )
  );
  const result = config.target === "heading" ? insertUnderHeading(body, config, defsBlock, pairs) : appendAtEnd(body, defsBlock);
  return { text: result, changed: result !== text };
}
function appendAtEnd(body, defsBlock) {
  const trimmed = body.replace(/\s+$/, "");
  return trimmed.length ? `${trimmed}

${defsBlock}
` : `${defsBlock}
`;
}
function insertUnderHeading(body, config, defsBlock, pairs) {
  const headingLine = `${"#".repeat(config.headingLevel)} ${config.headingText.trim()}`;
  const masks = buildMasks(body, pairs);
  const lineInfos = splitLinesWithOffsets(body);
  const lines = lineInfos.map((l) => l.text);
  const headingIdx = findHeading(lineInfos, config, masks);
  if (headingIdx === -1) {
    const trimmed = body.replace(/\s+$/, "");
    const head = trimmed.length ? `${trimmed}

` : "";
    return `${head}${headingLine}

${defsBlock}
`;
  }
  let sectionEnd = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const lvl = headingLevel(lines[i], lineInfos[i].start, masks);
    if (lvl > 0 && lvl <= config.headingLevel) {
      sectionEnd = i;
      break;
    }
  }
  let bodyEnd = sectionEnd;
  while (bodyEnd > headingIdx + 1 && /^\s*$/.test(lines[bodyEnd - 1])) bodyEnd--;
  const before = lines.slice(0, bodyEnd);
  const after = lines.slice(sectionEnd);
  const rebuilt = [...before, "", ...defsBlock.split("\n")];
  if (after.length) rebuilt.push("", ...after);
  return rebuilt.join("\n").replace(/\s+$/, "") + "\n";
}
function findHeading(lineInfos, config, masks) {
  const wanted = config.headingText.trim();
  for (let i = 0; i < lineInfos.length; i++) {
    const info = lineInfos[i];
    if (isMasked(info.start, masks)) continue;
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(info.text);
    if (!m) continue;
    if (m[1].length !== config.headingLevel) continue;
    if (m[2].trim() !== wanted) continue;
    return i;
  }
  return -1;
}
function headingLevel(line, offset, masks) {
  if (isMasked(offset, masks)) return 0;
  const m = /^(#{1,6})\s+\S/.exec(line);
  return m ? m[1].length : 0;
}

// src/core/tidy.ts
function tidyDocument(text, config, options) {
  if (!options.reindex && !options.consolidate) {
    return { text, changed: false, skipped: false, issues: [] };
  }
  const pairs = parseDelimiters(config.delimiters);
  const parsed = parseFootnotes(text, pairs);
  if (parsed.refs.length === 0 && parsed.defs.length === 0) {
    return { text, changed: false, skipped: false, issues: [] };
  }
  const validation = validateFootnotes(parsed);
  if (!validation.ok) {
    return { text, changed: false, skipped: true, issues: validation.issues };
  }
  let out = text;
  if (options.reindex) out = reindexDocument(out, pairs).text;
  if (options.consolidate) out = consolidateDocument(out, pairs, config.consolidate).text;
  return { text: out, changed: out !== text, skipped: false, issues: [] };
}

// src/core/sidebarModel.ts
function buildSidebarEntries(parsed) {
  const firstAppearance = /* @__PURE__ */ new Map();
  const consider = (label, offset) => {
    const prev = firstAppearance.get(label);
    if (prev === void 0 || offset < prev) firstAppearance.set(label, offset);
  };
  const firstRef = /* @__PURE__ */ new Map();
  for (const r of parsed.refs) {
    if (!firstRef.has(r.label)) firstRef.set(r.label, r.start);
    consider(r.label, r.start);
  }
  const def = /* @__PURE__ */ new Map();
  for (const d of parsed.defs) {
    if (!def.has(d.label)) def.set(d.label, { offset: d.start, line: d.line, content: d.content });
    consider(d.label, d.start);
  }
  const labels = [...firstAppearance.keys()].sort(
    (a, b) => firstAppearance.get(a) - firstAppearance.get(b)
  );
  return labels.map((label) => {
    const d = def.get(label);
    return {
      label,
      firstRefOffset: firstRef.has(label) ? firstRef.get(label) : null,
      defOffset: d ? d.offset : null,
      defLine: d ? d.line : null,
      content: d ? d.content : ""
    };
  });
}
function sidebarEntriesFor(text, pairs) {
  return buildSidebarEntries(parseFootnotes(text, pairs));
}
function refLabelAtOffset(text, pairs, offset) {
  const { refs } = parseFootnotes(text, pairs);
  for (const r of refs) {
    if (offset >= r.start && offset < r.end) return r.label;
  }
  return null;
}
function refLabelByIndex(text, pairs, index) {
  const { refs } = parseFootnotes(text, pairs);
  const r = refs[index];
  return r ? r.label : null;
}

// src/obsidian/adapter.ts
var import_view = require("@codemirror/view");
function patchManualSave(app, onSave) {
  var _a;
  const commands = app.commands;
  const cmd = (_a = commands == null ? void 0 : commands.commands) == null ? void 0 : _a["editor:save-file"];
  if (!cmd) return () => void 0;
  const original = cmd.callback;
  cmd.callback = () => {
    original == null ? void 0 : original();
    onSave();
  };
  return () => {
    cmd.callback = original;
  };
}
function addRightRibbonButton(app, icon, label, onClick, setIcon2) {
  var _a;
  const internals = app.workspace;
  const make = (parent, cls) => {
    const btn = parent.createEl("div", {
      cls,
      attr: { "aria-label": label, title: label }
    });
    setIcon2(btn, icon);
    btn.addEventListener("click", onClick);
    return btn;
  };
  try {
    const rightRibbon = internals.rightRibbon;
    if (rightRibbon == null ? void 0 : rightRibbon.containerEl) {
      const btn = make(rightRibbon.containerEl, "side-dock-ribbon-action");
      return () => btn.remove();
    }
  } catch (e) {
  }
  try {
    const ribbonEl = activeDocument.querySelector(".workspace-ribbon.mod-right");
    if (ribbonEl) {
      const btn = make(ribbonEl, "side-dock-ribbon-action");
      return () => btn.remove();
    }
  } catch (e) {
  }
  try {
    const containerEl = (_a = internals.rightSplit) == null ? void 0 : _a.containerEl;
    if (containerEl) {
      const btn = make(containerEl, "fm-right-panel-btn");
      return () => btn.remove();
    }
  } catch (e) {
  }
  return () => void 0;
}
var FOOTNOTE_REF_SELECTOR = "a.footnote-ref, sup.footnote-ref, .footnote-ref";
function closestFootnoteRef(target) {
  if (!(target instanceof HTMLElement)) return null;
  return target.closest(FOOTNOTE_REF_SELECTOR);
}
function footnoteRefIndexInRoot(el, root) {
  const all = Array.from(root.querySelectorAll(FOOTNOTE_REF_SELECTOR));
  return all.indexOf(el);
}
function createEditorClickExtension(handler) {
  return import_view.EditorView.domEventHandlers({
    mousedown: (event, view) => {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;
      const consumed = handler({ docText: view.state.doc.toString(), offset: pos }, event);
      if (consumed) {
        event.preventDefault();
        return true;
      }
      return false;
    }
  });
}

// src/main.ts
var AUTO_INTERVAL_MS = 2 * 60 * 1e3;
var STATUS_CLEAR_MS = 4e3;
var FootnoteMgrPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = defaultSettings();
    // Runtime mirrors of the two sidebar toggle buttons (persisted to settings).
    this.showFull = false;
    this.idxHighlight = true;
    this.statusBarEl = null;
    this.statusTimer = 0;
    this.lastActiveMarkdownFile = null;
    this.cleanups = [];
    this.debouncedRefresh = (0, import_obsidian3.debounce)(() => this._refreshSidebar(), 200, true);
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new FootnoteMgrSettingTab(this.app, this));
    this.registerView(SIDEBAR_VIEW_TYPE, (leaf) => new FootnoteSidebarView(leaf, this));
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("fm-status");
    this.addCommand({
      id: "tidy-footnotes",
      name: "Tidy footnotes in current note",
      callback: () => void this.runManualTidy()
    });
    this.addCommand({
      id: "show-footnote-sidebar",
      name: "Show footnote sidebar",
      callback: () => void this.revealSidebar()
    });
    this.addRibbonIcon("list-ordered", "Footnote Manager: show footnotes", () => {
      void this.revealSidebar();
    });
    this.registerEditorExtension(
      createEditorClickExtension((click, event) => this.onEditorClick(click, event))
    );
    this.registerDomEvent(activeDocument, "click", (evt) => this.onReadingClick(evt));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.debouncedRefresh()));
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        this.updateLastActiveMarkdownFile(file);
        this._refreshSidebar();
        window.setTimeout(() => this.tidyActiveEditor(true), 50);
      })
    );
    const unpatch = patchManualSave(this.app, () => this.tidyActiveEditor(true));
    this.cleanups.push(unpatch);
    this.registerInterval(window.setInterval(() => this.tidyActiveEditor(true), AUTO_INTERVAL_MS));
    this.app.workspace.onLayoutReady(() => {
      this.updateLastActiveMarkdownFile(this.app.workspace.getActiveFile());
      const button = addRightRibbonButton(
        this.app,
        "list-ordered",
        "Footnote Manager: show footnotes",
        () => void this.revealSidebar(),
        import_obsidian3.setIcon
      );
      this.cleanups.push(button);
      if (this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE).length === 0) {
        const leaf = this.app.workspace.getRightLeaf(false);
        if (leaf) void leaf.setViewState({ type: SIDEBAR_VIEW_TYPE });
      }
      this._refreshSidebar();
    });
  }
  onunload() {
    for (const fn of this.cleanups) {
      try {
        fn();
      } catch (e) {
      }
    }
    this.cleanups = [];
    window.clearTimeout(this.statusTimer);
  }
  async loadSettings() {
    this.settings = migrateSettings(await this.loadData());
    this.showFull = this.settings.showFullByDefault;
    this.idxHighlight = this.settings.idxHighlightEnabled;
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  // ── Active-file helpers ────────────────────────────────────────────────────
  updateLastActiveMarkdownFile(file) {
    if (file && file.extension === "md") this.lastActiveMarkdownFile = file;
  }
  getActiveMarkdownFile() {
    const active = this.app.workspace.getActiveFile();
    return active && active.extension === "md" ? active : this.lastActiveMarkdownFile;
  }
  // Current text of the active markdown note, or the last active one when focus
  // is on the sidebar. Read from the live editor buffer so the sidebar reflects
  // unsaved edits.
  activeDocText() {
    var _a;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian3.MarkdownView);
    if (view) return view.getViewData();
    const file = this.lastActiveMarkdownFile;
    if (!file) return null;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof import_obsidian3.MarkdownView && ((_a = leaf.view.file) == null ? void 0 : _a.path) === file.path) {
        return leaf.view.getViewData();
      }
    }
    return null;
  }
  getSidebarEntries() {
    const text = this.activeDocText();
    if (text === null) return [];
    return sidebarEntriesFor(text, parseDelimiters(this.settings.excludedDelimiters));
  }
  // ── Sidebar plumbing ───────────────────────────────────────────────────────
  getSidebarView() {
    for (const leaf of this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)) {
      if (leaf.view instanceof FootnoteSidebarView) return leaf.view;
    }
    return null;
  }
  refreshSidebar() {
    this.debouncedRefresh();
  }
  _refreshSidebar() {
    var _a;
    (_a = this.getSidebarView()) == null ? void 0 : _a.render();
  }
  async revealSidebar() {
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
  toggleShowFull() {
    this.showFull = !this.showFull;
    this.settings.showFullByDefault = this.showFull;
    void this.saveSettings();
    this._refreshSidebar();
  }
  toggleIdx() {
    this.idxHighlight = !this.idxHighlight;
    this.settings.idxHighlightEnabled = this.idxHighlight;
    void this.saveSettings();
    this._refreshSidebar();
  }
  // ── Navigation ─────────────────────────────────────────────────────────────
  async jumpToOffset(offset) {
    const file = this.getActiveMarkdownFile();
    if (!file) return;
    const existing = this.app.workspace.getLeavesOfType("markdown").find((l) => {
      var _a;
      return l.view instanceof import_obsidian3.MarkdownView && ((_a = l.view.file) == null ? void 0 : _a.path) === file.path;
    });
    let leaf;
    if (existing) {
      leaf = existing;
      await this.app.workspace.revealLeaf(leaf);
    } else {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
    await new Promise((r) => window.setTimeout(r, 50));
    const view = leaf.view;
    if (view instanceof import_obsidian3.MarkdownView) {
      const editor = view.editor;
      const pos = editor.offsetToPos(offset);
      editor.setCursor(pos);
      editor.scrollIntoView({ from: pos, to: pos }, true);
      editor.focus();
    }
  }
  // ── Index-click → sidebar highlight ────────────────────────────────────────
  onEditorClick(click, _event) {
    var _a;
    if (!this.idxHighlight) return false;
    const label = refLabelAtOffset(
      click.docText,
      parseDelimiters(this.settings.excludedDelimiters),
      click.offset
    );
    if (label) (_a = this.getSidebarView()) == null ? void 0 : _a.highlight(label);
    return false;
  }
  onReadingClick(evt) {
    var _a, _b;
    if (!this.idxHighlight) return;
    const el = closestFootnoteRef(evt.target);
    if (!el) return;
    const root = (_a = el.closest(".markdown-preview-view")) != null ? _a : activeDocument.body;
    const index = footnoteRefIndexInRoot(el, root);
    if (index < 0) return;
    const text = this.activeDocText();
    if (text === null) return;
    const label = refLabelByIndex(text, parseDelimiters(this.settings.excludedDelimiters), index);
    if (label) (_b = this.getSidebarView()) == null ? void 0 : _b.highlight(label);
  }
  // ── Tidy execution ─────────────────────────────────────────────────────────
  // Manual invocation (command palette / sidebar refresh button): runs every
  // enabled capability regardless of its manual-vs-automatic setting.
  async runManualTidy() {
    this.tidyActiveEditor(false);
    this._refreshSidebar();
  }
  // Runs a tidy pass on the active markdown editor. `auto` selects between the
  // automatic subset (capabilities whose Automatic switch is on) and the full
  // manual set. Reading Mode is never mutated; edits go through a single editor
  // transaction so cursor, selection, scroll, and undo are preserved.
  tidyActiveEditor(auto) {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian3.MarkdownView);
    if (!view || view.getMode() === "preview") return;
    const options = auto ? {
      reindex: this.settings.reindexEnabled && this.settings.reindexAuto,
      consolidate: this.settings.consolidateEnabled && this.settings.consolidateAuto
    } : {
      reindex: this.settings.reindexEnabled,
      consolidate: this.settings.consolidateEnabled
    };
    if (!options.reindex && !options.consolidate) return;
    const editor = view.editor;
    const oldText = editor.getValue();
    const result = tidyDocument(oldText, toTidyConfig(this.settings), options);
    if (result.skipped) {
      if (!auto) new import_obsidian3.Notice(`Footnote Manager: skipped \u2014 ${describeIssues(result.issues)}`);
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
  writeViaTransaction(editor, oldText, newText) {
    const cursorOffset = editor.posToOffset(editor.getCursor());
    const scroll = editor.getScrollInfo();
    editor.transaction({
      changes: [{ from: { line: 0, ch: 0 }, to: editor.offsetToPos(oldText.length), text: newText }],
      selection: { from: editor.offsetToPos(Math.min(cursorOffset, newText.length)) }
    });
    editor.scrollTo(scroll.left, scroll.top);
  }
  flashStatus(message = "Footnotes tidied") {
    if (!this.statusBarEl) return;
    this.statusBarEl.setText(message);
    window.clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => {
      var _a;
      return (_a = this.statusBarEl) == null ? void 0 : _a.setText("");
    }, STATUS_CLEAR_MS);
  }
};
