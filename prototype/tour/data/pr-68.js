// Tour of PR 68: the github skin reworked for separation, density, and one meaning per color.
// Every claim comes from `gh pr diff 68` and the PR description. Scenes use the page tokens only;
// the skin's own purple, green, and blue are named as values from the diff.

const PURPLE = 'light-dark(#8250df, #986ee2)'
const GREEN = 'light-dark(#1a7f37, #57ab5a)'
const BLUE = 'light-dark(#0969da, #539bf5)'

// Octicon paths copied from the `--i-*` masks in skin-github.css.
const ICON = {
  copy: 'M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z',
  comment:
    'M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z',
  check:
    'M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z',
  send: 'M.989 8 .064 2.68a1.342 1.342 0 0 1 1.85-1.462l13.402 5.744a1.13 1.13 0 0 1 0 2.076L1.913 14.782a1.343 1.343 0 0 1-1.85-1.463L.99 8Zm.603-5.288L2.38 7.25h4.87a.75.75 0 0 1 0 1.5H2.38l-.788 4.538L13.929 8Z',
  plus: 'M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z',
  moon: 'M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.499 5.499 0 1 0 7.678-7.678Z',
  auto: 'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 1.5v13a6.5 6.5 0 0 0 0-13Z',
}

/** @param {keyof typeof ICON} name */
function svg(name) {
  return `<svg class="sc-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="${ICON[name]}"/></svg>`
}

export default {
  key: 68,
  title: 'feat: cleaner github skin with clear section and file separation',
  repo: 'vintasoftware/pr-review-canvas',
  url: 'https://github.com/vintasoftware/pr-review-canvas/pull/68',
  head: '0640fa0',
  author: 'fjsj',
  changed: { files: 24, added: 1375, removed: 162 },
  spec: {
    kind: 'pr-description',
    title: 'feat: cleaner github skin with clear section and file separation',
    url: 'https://github.com/vintasoftware/pr-review-canvas/pull/68',
  },

  landmarks: [
    {
      id: 'l0',
      stage: 'background',
      title: 'The review page, and the skin most readers see',
      lead: 'A canvas is layers of tests, attention points, and files; the github skin dresses that page for GitHub users and is the default.',
      body: [
        'The review page shows a canvas as a rail of layers on the left and one layer section after another. Inside a layer come the summary, a Tests table, the Attention points, and the changed Files, each file card rendered by a `<pr-file>` element that wraps an `article.file`. Every command, from copy and ask to approve, is one `.cmd` class throughout.',
        'Three skins dress that markup: the base look with `[ bracket ]` commands, github, and olive. The github skin is the default and the one a GitHub user sees first; it overrides the component stylesheets by specificity. The markup is built in JavaScript, so a stylesheet can name a class nothing writes and no tool notices.',
        'Why it matters: users said they could not tell where a section ended and the next file began, and asked for more of a layer on one screen. A skin named after GitHub also sets expectations, for what a button looks like and for what blue means, and the page used blue for links, for the current layer, and for tests alike.',
      ],
      scene: {
        html: `
<div class="sc-l0">
  <div class="sc-l0-page">
    <div class="sc-l0-rail"><span>Overview</span><span class="sc-l0-cur">Storage lifecycle</span><span>Retention config</span><span>Other changes</span></div>
    <div class="sc-l0-layer">
      <div class="sc-l0-lh"><span class="sc-l0-lbl">Layer 2 of 7</span>Storage lifecycle</div>
      <div class="sc-l0-body">Blobs past their retention window are deleted by a job.</div>
      <div class="sc-l0-bar">Tests</div>
      <div class="sc-l0-row"><span>Deletes expired blobs</span><span class="sc-l0-pill">test</span></div>
      <div class="sc-l0-bar">Attention points · 1</div>
      <div class="sc-l0-row"><span class="sc-l0-sq"></span><span>Retention is read at startup only</span><span class="sc-l0-cmd">[ copy ] [ ask ]</span></div>
      <div class="sc-l0-bar">Files · 2</div>
      <div class="sc-l0-file"><code>src/storage/lifecycle.ts</code><span class="sc-l0-cmd">[ ask ]</span></div>
      <div class="sc-l0-file"><code>src/storage/lifecycle.test.ts</code><span class="sc-l0-cmd">[ ask ]</span></div>
    </div>
  </div>
  <dl class="sc-l0-legend">
    <dt>rail</dt><dd><code>.tree a</code>, the current layer marked in blue, the link color</dd>
    <dt>section title</dt><dd><code>.lbl.sub</code>, a grey bar with a border above and below</dd>
    <dt>file card</dt><dd><code>&lt;pr-file&gt;&lt;article class="file"&gt;</code>; the base hairline rule is <code>.file + .file</code></dd>
    <dt>command</dt><dd><code>.cmd</code> everywhere; the base look brackets it, the github skin decides which become buttons</dd>
  </dl>
</div>`,
        css: `
.sc-l0 { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; max-width: 100%; font: 12px/1.45 var(--sans); color: var(--fg); }
.sc-l0-page { display: grid; grid-template-columns: 96px minmax(0, 1fr); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: var(--panel); min-width: 0; }
.sc-l0-rail { display: flex; flex-direction: column; gap: 4px; padding: 8px; border-right: 1px solid var(--line); font-size: 11px; color: var(--fg-muted); }
.sc-l0-cur { color: var(--accent); box-shadow: inset 2px 0 0 var(--accent); padding-left: 4px; }
.sc-l0-layer { min-width: 0; }
.sc-l0-lh { padding: 8px 10px; border-bottom: 1px solid var(--line); font-weight: 600; font-size: 13px; }
.sc-l0-lbl { color: var(--accent); font-weight: 500; font-size: 11px; margin-right: 8px; }
.sc-l0-body { padding: 8px 10px; color: var(--fg-muted); }
.sc-l0-bar { padding: 7px 10px 5px; border-top: 1px solid var(--fg-muted); border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--fg) 6%, var(--panel)); font-weight: 600; }
.sc-l0-row { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; padding: 6px 10px; }
.sc-l0-pill { color: var(--accent); font-size: 11px; }
.sc-l0-sq { width: 8px; height: 8px; border-radius: 2px; background: var(--bad); flex: 0 0 8px; }
.sc-l0-cmd { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--accent); white-space: nowrap; }
.sc-l0-file { display: flex; gap: 8px; align-items: center; padding: 6px 10px; font-family: var(--mono); font-size: 11px; }
.sc-l0-file code { min-width: 0; overflow-wrap: anywhere; }
.sc-l0-file + .sc-l0-file { border-top: 0; }
.sc-l0-legend { margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 10px; align-content: start; }
.sc-l0-legend dt { font-weight: 600; white-space: nowrap; }
.sc-l0-legend dd { margin: 0; color: var(--fg-muted); }
.sc-l0-legend code { font-family: var(--mono); font-size: 11px; color: var(--fg); }`,
      },
      micro: null,
      code: [],
      decisions: [],
    },

    {
      id: 'l1',
      stage: 'world',
      title: 'A layer you can read at a glance',
      lead: 'Inside a layer, Tests, Attention points, and Files each get a title over their own box, and every file is a card.',
      body: [
        'Users said it was hard to tell sections and files apart in the github skin. Inside a layer, tests, attention points, and files ran together, and a new file had no top border or space above it. The terminal skin was missing the same line between files, for the same reason.',
        'The skin now gives Conversation, Tests, Attention points, and Files a plain title over their own rounded box. Each file is its own card with a 12px gap. Base text drops to 13px with tighter padding. Purple marks where you are, green marks progress and the primary action, and commands split into buttons, icon buttons, and links.',
        '`pnpm check` also gains `lint:css`: Stylelint, plus a script that fails on a styled class no source writes and on a custom property set but never read.',
      ],
      scene: {
        html: `
<div class="sc-ba">
  <figure class="sc-ba-col">
    <figcaption>Before</figcaption>
    <div class="sc-ba-layer">
      <div class="sc-ba-lh"><span class="sc-ba-lbl sc-ba-lbl-blue">Layer 2 of 7</span>Storage lifecycle</div>
      <div class="sc-ba-bar">Tests</div>
      <div class="sc-ba-row"><span>Deletes expired blobs</span><span class="sc-ba-muted">covered</span></div>
      <div class="sc-ba-bar">Attention points · 1</div>
      <div class="sc-ba-row"><span class="sc-ba-sq"></span><span>Retention is read at startup only</span></div>
      <div class="sc-ba-bar">Files · 2</div>
      <div class="sc-ba-file"><div class="sc-ba-fh">src/storage/lifecycle.ts</div><div class="sc-ba-diff"><i class="sc-ba-add">+ if (age > retention) …</i></div></div>
      <div class="sc-ba-file sc-ba-file-flush"><div class="sc-ba-fh">src/storage/lifecycle.test.ts</div><div class="sc-ba-diff"><i class="sc-ba-add">+ it('deletes expired', …)</i></div></div>
      <div class="sc-ba-end"><span class="sc-ba-link">[ mark layer as reviewed ]</span></div>
    </div>
  </figure>
  <figure class="sc-ba-col">
    <figcaption>After</figcaption>
    <div class="sc-ba-layer sc-ba-after">
      <div class="sc-ba-lh"><span class="sc-ba-lbl sc-ba-lbl-purple">Layer 2 of 7</span>Storage lifecycle</div>
      <h4 class="sc-ba-sub"><span class="sc-ba-dot sc-ba-dot-green"></span>Tests</h4>
      <div class="sc-ba-box"><div class="sc-ba-row"><span>Deletes expired blobs</span><span class="sc-ba-green">covered</span></div></div>
      <h4 class="sc-ba-sub"><span class="sc-ba-dot sc-ba-dot-purple"></span>Attention points · 1</h4>
      <div class="sc-ba-box"><div class="sc-ba-row"><span class="sc-ba-sq"></span><span>Retention is read at startup only</span></div></div>
      <h4 class="sc-ba-sub">Files · 2</h4>
      <div class="sc-ba-files">
        <div class="sc-ba-card"><div class="sc-ba-fh">src/storage/lifecycle.ts</div><div class="sc-ba-diff"><i class="sc-ba-add">+ if (age > retention) …</i></div></div>
        <div class="sc-ba-card"><div class="sc-ba-fh">src/storage/lifecycle.test.ts <span class="sc-ba-pill">test</span></div><div class="sc-ba-diff"><i class="sc-ba-add">+ it('deletes expired', …)</i></div></div>
      </div>
      <div class="sc-ba-end"><span class="sc-ba-btn">${svg('check')}mark layer as reviewed</span></div>
    </div>
  </figure>
</div>`,
        css: `
.sc-ba { --sc-purple: ${PURPLE}; --sc-green: ${GREEN}; --sc-blue: ${BLUE}; display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; max-width: 100%; font: 12px/1.45 var(--sans); color: var(--fg); }
.sc-ba-col { margin: 0; min-width: 0; }
.sc-ba-col figcaption { font-family: var(--mono); font-size: 11px; color: var(--fg-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.sc-ba-layer { border: 1px solid var(--line); background: var(--panel); overflow: hidden; }
.sc-ba-after { border-radius: 6px; font-size: 11.5px; }
.sc-ba-lh { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: baseline; padding: 8px 10px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--fg) 5%, var(--panel)); font-weight: 600; font-size: 1.15em; }
.sc-ba-lbl { font-size: 0.8em; font-weight: 500; }
.sc-ba-lbl-blue { color: var(--sc-blue); }
.sc-ba-lbl-purple { color: var(--sc-purple); }
.sc-ba-bar { padding: 9px 10px 6px; border-top: 1px solid var(--fg-muted); border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--fg) 6%, var(--panel)); font-weight: 600; }
.sc-ba-row { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; padding: 6px 10px; }
.sc-ba-muted { color: var(--fg-muted); }
.sc-ba-green { color: var(--sc-green); }
.sc-ba-sq { width: 8px; height: 8px; border-radius: 2px; background: var(--bad); flex: 0 0 8px; }
.sc-ba-file { background: var(--panel); }
.sc-ba-file-flush { border-top: 0; }
.sc-ba-fh { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 10px; font-family: var(--mono); font-size: 0.95em; font-weight: 600; border-bottom: 1px solid var(--line); }
.sc-ba-diff { padding: 4px 10px 6px; font-family: var(--mono); font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-ba-add { font-style: normal; background: color-mix(in srgb, var(--ok) 16%, var(--panel)); padding: 1px 4px; }
.sc-ba-end { display: flex; justify-content: flex-end; padding: 10px; }
.sc-ba-link { font-family: var(--mono); color: var(--accent); }
.sc-ba-sub { display: flex; align-items: center; gap: 8px; margin: 12px 12px 5px; padding: 0 2px; font-size: 1em; font-weight: 600; }
.sc-ba-dot { width: 8px; height: 8px; border-radius: 2px; }
.sc-ba-dot-green { background: var(--sc-green); }
.sc-ba-dot-purple { background: var(--sc-purple); }
.sc-ba-box { margin: 0 12px; border: 1px solid var(--line); border-radius: 6px; }
.sc-ba-files { padding: 0 12px; }
.sc-ba-card { border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: var(--panel); }
.sc-ba-card + .sc-ba-card { margin-top: 12px; }
.sc-ba-pill { font-family: var(--sans); font-weight: 500; font-size: 0.85em; padding: 0 6px; border-radius: 1em; color: var(--sc-green); background: color-mix(in srgb, var(--sc-green) 14%, var(--panel)); }
.sc-ba-btn { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px; background: color-mix(in srgb, var(--fg) 4%, var(--panel)); font-weight: 500; }
.sc-ba .sc-ico { width: 13px; height: 13px; fill: currentcolor; opacity: 0.85; }`,
      },
      micro: null,
      code: [
        {
          path: 'static/styles/skin-github.css',
          lang: 'css',
          diff: `@@ -4,15 +4,25 @@
 :root[data-skin='github'] {
   --r: 6px;
+  --fs: 13px;
   --gap: 16px;
   --main-pad: 16px 16px 40px;
+  /* How far a section's Box sits in from its card's edge. */
+  --inset: 12px;`,
        },
        {
          path: 'static/styles/skin-github.css',
          lang: 'css',
          diff: `@@ -20,33 +30,37 @@
   --purple: light-dark(#8250df, #986ee2);
-  --annot-bg: light-dark(#fbefff, rgba(152, 110, 226, 0.15));
+  --annot-bg: light-dark(#fbefff, rgb(152 110 226 / 15%));
+  /* Purple marks where you are and what needs attention; green marks tests and done. Blue stays
+     the link color, as on GitHub. */
+  --tint-attention: light-dark(#f7f2ff, rgb(152 110 226 / 14%));
+  --tint-done: light-dark(#dafbe1, rgb(87 171 90 / 15%));
   --ok: light-dark(#1a7f37, #57ab5a);
   --bad: light-dark(#d1242f, #e5534b);
   --warn: light-dark(#9a6700, #c69026);`,
        },
      ],
      literate: [
        'The change starts at the skin’s root, where two new tokens carry its two ideas. `--fs: 13px` is the denser base text, where the base stylesheet has 14px. `--inset` is how far a section’s box sits in from its card edge, the one distance every box and file card below will use:',
        { chunk: 0 },
        'Next to them, two tints name the colors’ jobs, and the comment is the rule the rest of the file follows: purple for where you are and what needs attention, green for tests and done, blue stays a link. The old `--annot-bg` only changes notation:',
        { chunk: 1 },
        'The rest of the skin is these tokens applied, section by section, and the next three landmarks walk them. The third part of this change, `lint:css`, is what guarantees a token set here is read somewhere.',
      ],
      decisions: [],
    },

    {
      id: 'l2',
      stage: 'why',
      title: 'One box per section, one card per file',
      lead: 'A section title is a plain heading, the block after it gets the border, and files get a border, a gap, and the hairline that never showed.',
      body: [
        'In the base stylesheet `.lbl.sub` is a grey bar with a border above and below. The github skin resets it to a flex title with a `--inset` margin and gives the block right after it, `.testmap`, `.findings`, or `.conversation`, the border and radius. A square before Tests and Attention points takes `--sect`: `--progress` for tests, `--purple` for points.',
        'Files were the harder case. Each card renders as `<pr-file><article class="file">`, so the base rule `.file + .file` never matched: the siblings are `pr-file` elements, not `.file`. It is now `pr-file + pr-file > .file`, which brings the hairline back in the terminal skin too. The github skin adds a border and radius per card and a 12px `margin-top` between cards.',
        'The Other changes layer holds its cards under a `<details>` with no `.files` list, so `details > pr-file > .file` insets those cards by `--inset` itself and keeps a gap under the last one.',
      ],
      scene: {
        html: `
<div class="sc-sel">
  <div class="sc-sel-tree" aria-label="The markup of a layer's files">
    <div class="sc-sel-node sc-sel-parent">div.files
      <div class="sc-sel-node sc-sel-wrap">pr-file
        <div class="sc-sel-node sc-sel-leaf" data-n="1">article.file</div>
      </div>
      <div class="sc-sel-node sc-sel-wrap" data-second="1">pr-file
        <div class="sc-sel-node sc-sel-leaf sc-sel-hit" data-n="2">article.file</div>
      </div>
    </div>
  </div>
  <div class="sc-sel-rules">
    <div class="sc-sel-rule sc-sel-miss">
      <code>.file + .file</code>
      <p>Needs a <code>.file</code> right after another <code>.file</code>. The first card has no next sibling at all: its <code>pr-file</code> ends. <b>0 matches.</b> No hairline, in either skin.</p>
    </div>
    <div class="sc-sel-rule sc-sel-ok">
      <code>pr-file + pr-file &gt; .file</code>
      <p>The second <code>pr-file</code> follows the first, and its child <code>.file</code> is the target. <b>1 match.</b> Terminal: a 1px line on top. GitHub: a 12px gap.</p>
    </div>
  </div>
</div>`,
        css: `
.sc-sel { --sc-green: ${GREEN}; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; max-width: 100%; font: 12px/1.45 var(--sans); color: var(--fg); }
.sc-sel-tree { min-width: 0; }
.sc-sel-node { font-family: var(--mono); font-size: 12px; padding: 6px 8px; border: 1px dashed var(--line); border-radius: 6px; color: var(--fg-muted); }
.sc-sel-node + .sc-sel-node { margin-top: 8px; }
.sc-sel-parent { background: var(--panel); }
.sc-sel-wrap { margin-top: 8px; border-style: solid; }
.sc-sel-leaf { margin-top: 6px; background: color-mix(in srgb, var(--fg) 4%, var(--panel)); color: var(--fg); }
.sc-sel-hit { border: 2px solid var(--sc-green); }
.sc-sel-hit::after { content: ' matched'; font-family: var(--sans); color: var(--sc-green); font-weight: 600; }
.sc-sel-rules { display: grid; gap: 10px; min-width: 0; }
.sc-sel-rule { padding: 8px 10px; border-radius: 6px; border: 1px solid var(--line); border-left-width: 4px; }
.sc-sel-rule > code { font-family: var(--mono); font-weight: 600; font-size: 12px; }
.sc-sel-rule p { margin: 4px 0 0; }
.sc-sel-rule p code { font-family: var(--mono); font-size: 11px; }
.sc-sel-miss { border-left-color: var(--bad); }
.sc-sel-miss > code { color: var(--bad); text-decoration: line-through; }
.sc-sel-ok { border-left-color: var(--sc-green); }
.sc-sel-ok > code { color: var(--sc-green); }`,
      },
      micro: {
        html: `
<div class="sc-mw">
  <div class="sc-mw-controls">
    <fieldset class="sc-mw-ctl"><legend>Base text</legend>
      <label><input type="radio" name="sc-mw-fs" value="14"> 14px, before</label>
      <label><input type="radio" name="sc-mw-fs" value="13" checked> 13px</label>
    </fieldset>
    <fieldset class="sc-mw-ctl"><legend>Section boxes</legend>
      <label><input type="radio" name="sc-mw-boxes" value="off"> off, grey bars</label>
      <label><input type="radio" name="sc-mw-boxes" value="on" checked> on, title over box</label>
    </fieldset>
    <fieldset class="sc-mw-ctl"><legend>File gap</legend>
      <label><input type="radio" name="sc-mw-gap" value="0"> 0</label>
      <label><input type="radio" name="sc-mw-gap" value="12" checked> 12px cards</label>
    </fieldset>
  </div>
  <div class="sc-mw-page" data-boxes="on" data-gap="12" data-fs="13">
    <div class="sc-mw-lh"><span class="sc-mw-lbl">Layer 2 of 7</span>Storage lifecycle</div>
    <div class="sc-mw-body">Blobs past their retention window are deleted by a job that runs at startup and every hour.</div>
    <h4 class="sc-mw-sub sc-mw-tests">Tests</h4>
    <div class="sc-mw-box">
      <div class="sc-mw-row sc-mw-head"><span>Behavior</span><span>Status</span></div>
      <div class="sc-mw-row"><span>Deletes expired blobs</span><span class="sc-mw-green">covered</span></div>
      <div class="sc-mw-row"><span>Keeps blobs inside the window</span><span class="sc-mw-green">covered</span></div>
    </div>
    <h4 class="sc-mw-sub sc-mw-points">Attention points · 1</h4>
    <div class="sc-mw-box">
      <div class="sc-mw-row sc-mw-point"><span class="sc-mw-sq"></span><span><b>Retention is read at startup only.</b> A config change waits for a restart.</span></div>
    </div>
    <h4 class="sc-mw-sub">Files · 2</h4>
    <div class="sc-mw-files">
      <div class="sc-mw-file"><div class="sc-mw-fh">src/storage/lifecycle.ts<span class="sc-mw-chk">reviewed</span></div><div class="sc-mw-diff"><i class="sc-mw-ctx">  const age = now - blob.createdAt</i><i class="sc-mw-add">+ if (age > retention) await remove(blob)</i></div></div>
      <div class="sc-mw-file"><div class="sc-mw-fh">src/storage/lifecycle.test.ts<span class="sc-mw-chk">reviewed</span></div><div class="sc-mw-diff"><i class="sc-mw-add">+ it('deletes expired blobs', async () => {</i><i class="sc-mw-add">+   await job.run()</i></div></div>
    </div>
    <div class="sc-mw-end"><span class="sc-mw-btn">mark layer as reviewed</span></div>
  </div>
  <p class="sc-mw-out">Same content, laid out: <b data-out>…</b> tall.</p>
</div>`,
        css: `
.sc-mw { --sc-purple: ${PURPLE}; --sc-green: ${GREEN}; max-width: 100%; font: 13px/1.5 var(--sans); color: var(--fg); }
.sc-mw-controls { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-bottom: 10px; font-size: 12px; }
.sc-mw-ctl { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0; padding: 4px 8px 6px; border: 1px solid var(--line); border-radius: 6px; }
.sc-mw-ctl legend { padding: 0 4px; color: var(--fg-muted); }
.sc-mw-ctl label { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.sc-mw-page { font-size: 13px; line-height: 1.5; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); overflow: hidden; }
.sc-mw-page[data-fs='14'] { font-size: 14px; }
.sc-mw-lh { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; padding: 8px 12px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--fg) 5%, var(--panel)); font-weight: 600; font-size: 1.23em; }
[data-fs='14'] .sc-mw-lh { padding: 10px 16px; }
.sc-mw-lbl { color: var(--sc-purple); font-size: 0.8em; font-weight: 500; }
.sc-mw-body { padding: 12px; color: var(--fg-muted); }
.sc-mw-sub { margin: 0; font-size: 1em; font-weight: 600; }
[data-boxes='off'] .sc-mw-sub { padding: 12px 16px 8px; border-top: 1px solid var(--fg-muted); border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--fg) 6%, var(--panel)); }
[data-boxes='on'] .sc-mw-sub { display: flex; align-items: center; gap: 8px; margin: 16px 12px 6px; padding: 0 2px; }
[data-boxes='on'] .sc-mw-tests::before, [data-boxes='on'] .sc-mw-points::before { content: ''; width: 8px; height: 8px; border-radius: 2px; background: var(--sc-green); }
[data-boxes='on'] .sc-mw-points::before { background: var(--sc-purple); }
[data-boxes='on'] .sc-mw-box { margin: 0 12px; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.sc-mw-row { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; padding: 4px 12px; }
[data-fs='14'] .sc-mw-row { padding: 5px 16px; }
.sc-mw-row + .sc-mw-row { border-top: 1px solid var(--line); }
.sc-mw-head { color: var(--fg-muted); font-weight: 500; }
.sc-mw-point { padding: 10px 12px; }
[data-fs='14'] .sc-mw-point { padding: 12px 16px; }
.sc-mw-green { color: var(--sc-green); }
.sc-mw-sq { width: 8px; height: 8px; border-radius: 2px; background: var(--bad); flex: 0 0 8px; }
[data-boxes='on'] .sc-mw-files { padding: 0 12px; }
.sc-mw-file { background: var(--panel); }
[data-boxes='on'] .sc-mw-file { border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
[data-boxes='off'][data-gap='0'] .sc-mw-file + .sc-mw-file { border-top: 0; }
[data-gap='12'] .sc-mw-file + .sc-mw-file { margin-top: 12px; }
.sc-mw-fh { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-height: 38px; padding: 4px 6px 4px 10px; font-family: var(--mono); font-size: 0.92em; font-weight: 600; border-bottom: 1px solid var(--line); }
[data-fs='14'] .sc-mw-fh { min-height: 42px; padding: 8px 16px; }
.sc-mw-chk { margin-left: auto; font-family: var(--sans); font-weight: 500; font-size: 12px; padding: 2px 8px; border: 1px solid var(--line); border-radius: 6px; background: color-mix(in srgb, var(--fg) 4%, var(--panel)); }
.sc-mw-diff { display: grid; padding: 4px 0; font-family: var(--mono); font-size: 0.9em; }
.sc-mw-diff i { font-style: normal; padding: 0 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-mw-add { background: color-mix(in srgb, var(--ok) 16%, var(--panel)); }
.sc-mw-ctx { color: var(--fg-muted); }
.sc-mw-end { display: flex; justify-content: flex-end; padding: 12px; }
.sc-mw-btn { display: inline-flex; align-items: center; height: 26px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px; background: color-mix(in srgb, var(--fg) 4%, var(--panel)); font-size: 12px; font-weight: 500; }
.sc-mw-out { margin: 8px 0 0; font-size: 12px; color: var(--fg-muted); }
.sc-mw-out b { color: var(--fg); font-family: var(--mono); }`,
        init: root => {
          const page = root.querySelector('.sc-mw-page')
          const out = root.querySelector('[data-out]')
          if (!(page instanceof HTMLElement) || !(out instanceof HTMLElement)) {
            return
          }
          const measure = () => {
            const h = page.offsetHeight
            out.textContent = h > 0 ? `${h}px` : '…'
          }
          const apply = () => {
            for (const [name, attr] of [
              ['sc-mw-fs', 'fs'],
              ['sc-mw-boxes', 'boxes'],
              ['sc-mw-gap', 'gap'],
            ]) {
              const picked = root.querySelector(`input[name="${name}"]:checked`)
              if (picked instanceof HTMLInputElement) {
                page.dataset[attr] = picked.value
              }
            }
            requestAnimationFrame(measure)
          }
          for (const input of root.querySelectorAll('input[type="radio"]')) {
            input.addEventListener('change', apply)
          }
          apply()
        },
      },
      code: [
        {
          path: 'static/styles/review.css',
          lang: 'css',
          diff: `@@ -418,12 +415,13 @@ details[open] > summary .chev,
 }

 /* file cards sit flush left under the layer's "Files" sub-header: a hairline between files and the
-   chevron before each path show the nesting; only the layer section carries the panel border and shadow */
+   chevron before each path show the nesting; only the layer section carries the panel border and shadow.
+   Each card is wrapped in its own <pr-file>, so the hairline goes between the wrappers. */
 .file {
   background: var(--panel);
   min-width: 0;
 }
-.file + .file {
+pr-file + pr-file > .file {
   border-top: 1px solid var(--line);
 }
 .files {`,
        },
        {
          path: 'static/styles/skin-github.css',
          lang: 'css',
          diff: `@@ -238,19 +419,126 @@
+[data-skin='github'] .lbl.sub {
+  display: flex;
+  align-items: center;
+  gap: 8px;
+  margin: 16px var(--inset) 6px;
+  padding: 0 2px;
+  border: 0;
+  background: none;
+  font-size: 13px;
+  font-weight: 600;
+}
+[data-skin='github'] .lbl.sub + :is(.testmap, .findings, .conversation) {
+  margin: 0 var(--inset);
+  border: 1px solid var(--line);
+  border-radius: var(--r);
+}
+/* A square before the title says what the section holds: green for tests, purple for points. */
+[data-skin='github'] .lbl.sub:is(:has(+ .testmap), :has(+ .findings))::before {
+  content: '';
+  width: 8px;
+  height: 8px;
+  border-radius: 2px;
+  background: var(--sect);
+}
+[data-skin='github'] .lbl.sub:has(+ .testmap) {
+  --sect: var(--progress);
+}
+[data-skin='github'] .lbl.sub:has(+ .findings) {
+  --sect: var(--purple);`,
        },
        {
          path: 'static/styles/skin-github.css',
          lang: 'css',
          diff: `@@ -238,19 +419,126 @@
+/* ---- Files: each one is its own card, with space between them ---- */
+[data-skin='github'] .files {
+  padding: 0 var(--inset);
+}
+[data-skin='github'] .file {
+  border: 1px solid var(--line);
+  border-radius: var(--r);
+  overflow: clip;
+}
+[data-skin='github'] pr-file + pr-file > .file {
+  margin-top: 12px;
+}
+/* The Other changes layer holds its cards straight under the summary, with no files list and no
+   closing row, so it insets them itself and keeps a gap under the last one. */
+[data-skin='github'] details > pr-file > .file {
+  margin-inline: var(--inset);
+}
+[data-skin='github'] details > pr-file:last-child > .file {
+  margin-bottom: var(--inset);
+}`,
        },
      ],
      literate: [
        'The bug first, because it explains the shape of everything after it. In the base stylesheet the hairline between files was `.file + .file`. Each card renders as `<pr-file><article class="file">`, so a `.file` never has a `.file` sibling, and the rule matched nothing in either skin. The selector now steps through the wrappers, and the comment records why:',
        { chunk: 0 },
        'With the hairline back, the github skin builds its sections. `.lbl.sub` stops being a grey bar and becomes a plain flex title, inset by `--inset`. The block right after it, tests, findings, or conversation, takes the border and the radius. A square before Tests and Attention points is colored by `--sect`, which `:has()` sets from the neighbor that follows:',
        { chunk: 1 },
        'Files follow the same idea one level down: the list is inset, each card gets a border and a radius, and the very selector that draws the hairline gives the 12px gap here. The Other changes layer has no `.files` list, so its cards inset themselves and keep a gap under the last one:',
        { chunk: 2 },
        'The micro-world on this landmark lets you switch each of these three moves off and on and watch the page height change.',
      ],
      decisions: ['d3'],
    },

    {
      id: 'l3',
      stage: 'why',
      title: 'Denser text, one meaning per color',
      lead: 'Base text drops to 13px with tighter padding, and purple, green, and blue each get one job.',
      body: [
        'The skin sets `--fs: 13px` on its root where the base has 14px, so everything sized in em follows. Padding tightens in the same pass: `.testmap` cells to 4px 12px, points to 10px 12px, the layer header to 8px 12px, rail items to 4px 8px. The overview summary stays at 14px and the layer title at 16px.',
        'Before, the current rail item was blue, the same as every link. Now `.tree a[aria-current]` gets a purple bar and the `--tint-attention` ground, on the narrow layout a purple underline, and the `Layer n of m` label is purple too. A file’s reviewer note takes the same tint.',
        'Green means tests and done. The Tests square uses `--progress`, the test pill moves from blue to `--tint-done` and `--ok`, a ticked `reviewed` toggle turns green, and Approve is the green primary once it is enabled. Blue stays the link color, as on GitHub.',
      ],
      scene: {
        html: `
<div class="sc-den">
  <div class="sc-den-ruler" aria-label="Sizes before and after">
    <div class="sc-den-scale"><span class="sc-den-tick" style="--at: 12">12</span><span class="sc-den-tick" style="--at: 13">13</span><span class="sc-den-tick" style="--at: 14">14</span><span class="sc-den-tick" style="--at: 16">16</span></div>
    <div class="sc-den-line"><span>body text</span><i class="sc-den-was" style="--at: 14"></i><i class="sc-den-now" style="--at: 13"></i></div>
    <div class="sc-den-line"><span>overview summary</span><i class="sc-den-now" style="--at: 14"></i></div>
    <div class="sc-den-line"><span>layer title</span><i class="sc-den-now" style="--at: 16"></i></div>
    <div class="sc-den-line"><span>point title</span><i class="sc-den-now" style="--at: 14"></i></div>
    <div class="sc-den-line"><span>buttons</span><i class="sc-den-now" style="--at: 12"></i></div>
    <div class="sc-den-line"><span>sign-off buttons</span><i class="sc-den-now" style="--at: 13"></i></div>
    <p class="sc-den-note"><i class="sc-den-key sc-den-was"></i> before <i class="sc-den-key sc-den-now"></i> now. Padding: table cells 4×12, points 10×12, layer header 8×12, rail items 4×8 (was 6×8).</p>
  </div>
  <div class="sc-den-legend">
    <div class="sc-den-swatch" style="--c: ${PURPLE}"><b>purple</b><span>where you are: the current rail item, the <code>Layer n of m</code> label. What needs you: the Attention points square, a reviewer note.</span></div>
    <div class="sc-den-swatch" style="--c: ${GREEN}"><b>green</b><span>tests and done: the Tests square, the test pill, a ticked <code>reviewed</code>, Approve once enabled.</span></div>
    <div class="sc-den-swatch" style="--c: ${BLUE}"><b>blue</b><span>a link, as on GitHub. Nothing else.</span></div>
  </div>
</div>`,
        css: `
.sc-den { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; max-width: 100%; font: 12px/1.45 var(--sans); color: var(--fg); }
.sc-den-ruler { --lo: 11; --hi: 17; min-width: 0; }
.sc-den-scale { position: relative; height: 16px; margin-left: 110px; border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 10px; color: var(--fg-muted); }
.sc-den-tick { position: absolute; left: calc((var(--at) - var(--lo)) / (var(--hi) - var(--lo)) * 100%); transform: translateX(-50%); }
.sc-den-line { position: relative; height: 22px; display: flex; align-items: center; }
.sc-den-line > span { width: 110px; flex: 0 0 110px; font-size: 11px; }
.sc-den-line > i { position: absolute; top: 5px; width: 12px; height: 12px; border-radius: 50%; left: calc(110px + (var(--at) - var(--lo)) / (var(--hi) - var(--lo)) * (100% - 110px)); transform: translateX(-50%); }
.sc-den-was { border: 2px dashed var(--fg-muted); box-sizing: border-box; }
.sc-den-now { background: var(--accent); }
.sc-den-note { margin: 6px 0 0; font-size: 11px; color: var(--fg-muted); }
.sc-den-key { display: inline-block; width: 10px; height: 10px; border-radius: 50%; vertical-align: -1px; }
.sc-den-legend { display: grid; gap: 8px; align-content: start; min-width: 0; }
.sc-den-swatch { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; align-items: start; padding: 8px 10px; border: 1px solid var(--line); border-left: 6px solid var(--c); border-radius: 6px; }
.sc-den-swatch b { color: var(--c); }
.sc-den-swatch code { font-family: var(--mono); font-size: 11px; }`,
      },
      micro: null,
      code: [
        {
          path: 'static/styles/skin-github.css',
          lang: 'css',
          diff: `@@ -238,19 +419,126 @@
+[data-skin='github'] .body {
+  padding: 12px;
+}
+[data-skin='github'] .summary {
+  font-size: 14px;
+}
+[data-skin='github'] .layer-h {
+  padding: 8px 12px;
+}
+[data-skin='github'] .layer-h h2 {
+  font-size: 16px;
+}
+[data-skin='github'] .layer-h .lbl {
+  color: var(--purple);
+}`,
        },
        {
          path: 'static/styles/skin-github.css',
          lang: 'css',
          diff: `@@ -238,19 +419,126 @@
 /* ---- Rail ---- */
 [data-skin='github'] .tree a {
   margin: 0 8px;
-  padding: 6px 8px;
+  padding: 4px 8px;
   border-radius: var(--r);
 }
 [data-skin='github'] .tree .layers a {
   padding-left: 20px;
 }
+/* Where you are is purple, so blue keeps meaning "a link". */
 [data-skin='github'] .tree a[aria-current] {
-  background: var(--accent-bg);
-  box-shadow: inset 3px 0 0 var(--accent);
+  background: var(--tint-attention);
+  box-shadow: inset 3px 0 0 var(--purple);
 }`,
        },
        {
          path: 'static/styles/skin-github.css',
          lang: 'css',
          diff: `@@ -187,8 +368,8 @@
   font-weight: 500;
 }
 [data-skin='github'] .pill.test-tag {
-  background: var(--accent-bg);
-  color: var(--accent);
+  background: var(--tint-done);
+  color: var(--ok);
   border-color: transparent;
   text-transform: none;
   letter-spacing: normal;`,
        },
      ],
      literate: [
        'Density is a handful of numbers, set in one place. `.body` gets 12px of padding, the overview summary stays at 14px against the 13px base, the layer header tightens to 8px 12px with a 16px title, and the `Layer n of m` label turns purple:',
        { chunk: 0 },
        'The rail is where blue lost a job. Its items tighten from 6px to 4px, and the current item swaps the accent, which is the link blue, for `--tint-attention` and a purple bar. The comment is the reason in one line:',
        { chunk: 1 },
        'Green gains one in return: the test pill moves from the accent tint to `--tint-done` and `--ok`, so a test reads as done rather than as a link:',
        { chunk: 2 },
        'Read the three hunks together and the legend on this landmark’s scene is the code, one color at a time. Two decisions wait here: purple for the current place, and 13px against readability.',
      ],
      decisions: ['d1', 'd4'],
    },

    {
      id: 'l4',
      stage: 'why',
      title: 'Buttons, icon buttons, and links',
      lead: 'One rule in the skin decides which commands are buttons; a second makes some of them icon-only; the rest stay quiet links.',
      body: [
        'The base skin draws every command as a `[ bracket ]` link. The github skin used to turn only the header’s commands into buttons. Now one `:is()` list names every button: the header toolbar, sign-off, a point’s copy, post, add to review, and resolve, the ask of a layer or file, `mark layer as reviewed`, and the `reviewed` toggles. Hover, disabled, primary, and ticked states nest inside it.',
        'Every command button but sign-off draws a glyph in `::before`: a CSS mask from the `--icon` the command sets, filled with `currentcolor`. Icon-only buttons are square and hide the word with `font-size: 0`; the word stays as the accessible name, and copy and the file ask get a `title` tooltip. The theme button shows sun, moon, or a half circle for auto.',
        'A point’s ask, dismiss, restore, reopen, and cancel stay links in muted text after the buttons. Post uses a paper airplane because it reads `post to gitlab` on GitLab. The icons live in `skin-github.css`, so the terminal skin keeps its brackets.',
      ],
      scene: {
        html: `
<div class="sc-cmd">
  <div class="sc-cmd-kind">
    <h4>Buttons <small>state changes and each block’s main verb</small></h4>
    <div class="sc-cmd-row">
      <span class="sc-cmd-btn sc-cmd-primary">approve on github</span>
      <span class="sc-cmd-btn">request changes</span>
      <span class="sc-cmd-btn sc-cmd-ticked">${svg('check')}reviewed</span>
      <span class="sc-cmd-btn">${svg('send')}post to github</span>
      <span class="sc-cmd-btn">${svg('plus')}add to review</span>
      <span class="sc-cmd-btn">${svg('check')}mark layer as reviewed</span>
    </div>
  </div>
  <div class="sc-cmd-kind">
    <h4>Icon buttons <small>universal verbs; the word stays for screen readers and the tooltip</small></h4>
    <div class="sc-cmd-row">
      <span class="sc-cmd-btn sc-cmd-square" title="Copy as Markdown">${svg('copy')}</span>
      <span class="sc-cmd-btn sc-cmd-square" title="Ask AI Chat about this file">${svg('comment')}</span>
      <span class="sc-cmd-btn sc-cmd-square" title="theme: dark">${svg('moon')}</span>
      <span class="sc-cmd-btn sc-cmd-square" title="theme: auto">${svg('auto')}</span>
      <span class="sc-cmd-tip">hover: “Copy as Markdown”, “Ask AI Chat about this file”</span>
    </div>
  </div>
  <div class="sc-cmd-kind">
    <h4>Links <small>light, reversible, or navigating</small></h4>
    <div class="sc-cmd-row">
      <span class="sc-cmd-link">ask</span>
      <span class="sc-cmd-link">view comment</span>
      <span class="sc-cmd-link">reopen</span>
      <span class="sc-cmd-link">cancel</span>
      <span class="sc-cmd-link sc-cmd-end">dismiss</span>
    </div>
  </div>
</div>`,
        css: `
.sc-cmd { --sc-green: ${GREEN}; display: grid; gap: 12px; max-width: 100%; font: 12px/1.45 var(--sans); color: var(--fg); }
.sc-cmd-kind h4 { margin: 0 0 6px; font-size: 12px; font-weight: 600; }
.sc-cmd-kind small { font-weight: 400; color: var(--fg-muted); }
.sc-cmd-row { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; padding: 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
.sc-cmd-btn { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px; background: color-mix(in srgb, var(--fg) 4%, var(--panel)); font-weight: 500; white-space: nowrap; }
.sc-cmd-primary { border-color: transparent; background: var(--sc-green); color: var(--panel); }
.sc-cmd-ticked { border-color: color-mix(in srgb, var(--sc-green) 40%, transparent); background: color-mix(in srgb, var(--sc-green) 14%, var(--panel)); color: var(--sc-green); }
.sc-cmd-square { width: 26px; padding: 0; justify-content: center; }
.sc-cmd .sc-ico { width: 14px; height: 14px; fill: currentcolor; opacity: 0.85; flex: 0 0 14px; }
.sc-cmd-tip { flex-basis: 100%; font-size: 11px; color: var(--fg-muted); }
.sc-cmd-link { padding: 0 4px; color: var(--fg-muted); }
.sc-cmd-end { margin-left: auto; }`,
      },
      micro: null,
      code: [
        {
          path: 'static/styles/skin-github.css',
          lang: 'css',
          diff: `@@ -146,6 +161,172 @@
+/* Buttons, GitHub's btn-sm. This list is the one place that decides which commands are buttons:
+   the header toolbar, sign-off, a point's verbs, the ask of a layer or file, the layer's last
+   step, the author's resolve, and the "reviewed" toggles. */
+[data-skin='github']
+  :is(
+    .hdr-actions .cmd,
+    .signoff .cmd,
+    :is(.findings, .ifind)
+      .cmd:is(
+        [data-copy],
+        [data-act='point-post'],
+        [data-act='point-queue'],
+        [data-act='point-settle'],
+        [data-act='settle-save']
+      ),
+    :is(.layer-ctl, .file-h) .cmd[data-act='ask'],
+    .layer-end .cmd,
+    .chk:has(input[data-reviewed-id])
+  ) {
+  display: inline-flex;
+  align-items: center;
+  gap: 6px;
+  height: var(--btn-h, 26px);
+  padding: 0 var(--btn-pad, 8px);
+  border: 1px solid var(--line);
+  border-radius: var(--r);
+  background: var(--btn-bg);
+  color: var(--fg);`,
        },
        {
          path: 'static/styles/skin-github.css',
          lang: 'css',
          diff: `@@ -146,6 +161,172 @@
+  /* Every command button but sign-off draws the glyph its \`--icon\` names below. A command left
+     without one draws nothing rather than a solid square. The text stays the accessible name. */
+  &.cmd:not(.signoff .cmd)::before {
+    content: '';
+    flex: 0 0 var(--icon-size, 14px);
+    width: var(--icon-size, 14px);
+    height: var(--icon-size, 14px);
+    background: currentcolor;
+    mask: var(--icon, linear-gradient(transparent, transparent)) center / contain no-repeat;
+    opacity: 0.85;
+  }
+  /* Icon-only buttons, square: the word is hidden from sight and kept for screen readers and the
+     tooltip. */
+  &:is(
+    .findings [data-copy],
+    .ifind [data-copy],
+    .file-h .cmd,
+    #settings,
+    [data-act='help'],
+    #skin-toggle,
+    #theme-toggle
+  ) {
+    justify-content: center;
+    width: var(--btn-h, 26px);
+    padding: 0;
+    gap: 0;
+    font-size: 0;
+  }
+}`,
        },
        {
          path: 'static/js/ask.js',
          lang: 'js',
          diff: `@@ -23,7 +23,8 @@ export function isChatEnabled() {
 /**
  * The command, or nothing at all when the pane is off: a page without a chat shows no way to ask.
  * @param {import('./chat-context.js').ChatContext} context
- * @param {{ label?: string, enabled?: boolean }} [opts]
+ * @param {{ label?: string, title?: string, enabled?: boolean }} [opts] \`title\` is the tooltip, for a
+ *   skin that shows the command as an icon
  * @returns {string}
  */
 export function askButtonHtml(context, opts = {}) {
@@ -31,5 +32,6 @@ export function askButtonHtml(context, opts = {}) {
     return ''
   }
   const label = opts.label ?? 'ask'
-  return \`<button class="cmd" type="button" data-act="ask" data-ask\${chatContextAttrs(context)}>\${esc(label)}</button>\`
+  const title = opts.title === undefined ? '' : \` title="\${esc(opts.title)}"\`
+  return \`<button class="cmd" type="button" data-act="ask" data-ask\${chatContextAttrs(context)}\${title}>\${esc(label)}</button>\`
 }`,
        },
      ],
      literate: [
        'One selector decides which commands are buttons. The `:is()` list names them by place and by `data-act`: the header toolbar, sign-off, a point’s copy, post, add, and resolve, the ask of a layer or a file, the layer’s last step, and the `reviewed` toggles. The declarations after it are GitHub’s btn-sm: inline-flex, 26px tall, a hairline border, the button background:',
        { chunk: 0 },
        'Nested inside that rule, two more decide how a button looks. `::before` draws a glyph by masking `currentcolor` with whatever `--icon` the command set, falling back to a transparent gradient so a command without one draws nothing rather than a solid square. A second nested `:is()` makes copy, the file ask, and the header toggles square and hides their word with `font-size: 0`, keeping it for screen readers:',
        { chunk: 1 },
        'Each command names its glyph with `--icon` in one block of one-liners. The theme button reads the theme it is on:',
        {
          path: 'static/styles/skin-github.css',
          lang: 'css',
          diff: `@@ -146,6 +161,172 @@
+/* Glyphs. */
+[data-skin='github'] .cmd[data-copy] {
+  --icon: var(--i-copy);
+}
+[data-skin='github'] .cmd[data-act='point-post'] {
+  --icon: var(--i-send);
+}
+[data-skin='github'] .cmd[data-act='point-queue'] {
+  --icon: var(--i-plus);
+}
+[data-skin='github'] .cmd[data-act='ask'] {
+  --icon: var(--i-comment);
+}
+[data-skin='github'] :is(.layer-end .cmd, [data-act='point-settle'], [data-act='settle-save']) {
+  --icon: var(--i-check);
+}
+/* The theme button shows the theme it is on. */
+[data-skin='github'] #theme-toggle {
+  --icon: var(--i-auto);
+}
+:root[data-skin='github'][data-theme='light'] #theme-toggle {
+  --icon: var(--i-sun);
+}
+:root[data-skin='github'][data-theme='dark'] #theme-toggle {
+  --icon: var(--i-moon);
+}`,
        },
        'Because the word is now invisible on those buttons, the two that are not self-explanatory get a tooltip. `askButtonHtml` grows a `title` option for the file ask, and points.js passes “Copy as Markdown” on the copy button. The words themselves never change, so the terminal skin still reads `[ copy ]` and `[ ask ]`:',
        { chunk: 2 },
      ],
      decisions: ['d2'],
    },

    {
      id: 'l5',
      stage: 'respect',
      title: 'What the skin now expects of you',
      lead: 'A new command joins one list, a new class must be written by some source, and each file keeps its own wrapper.',
      body: [
        'Commands: a new button joins the `:is()` list in `skin-github.css` and sets an `--icon`; an icon-only one also needs a `title`. A command not in the list renders as plain text. One in the list without an `--icon` draws no glyph: the mask falls back to a transparent gradient instead of a solid square.',
        'Markup: a section box needs its title as the previous sibling, because the box and the square come from `.lbl.sub + …` and `:has(+ …)`. Each file card stays inside its own `<pr-file>`: the hairline in both skins and the github gap match `pr-file + pr-file > .file`.',
        'Checks: `pnpm check` runs `lint:css`. Stylelint fails on an unknown custom property, and `scripts/check-css-usage.mjs` fails on a class no source writes and on a property set but never read, or read but never set. Names a library writes at run time go in `dynamic`. The theming probe reads `::after`, since `::before` now holds the icon.',
      ],
      scene: {
        html: `
<div class="sc-guard">
  <div class="sc-guard-item sc-guard-soft">
    <div class="sc-guard-do">You add a <code>.cmd</code> that is not in the button list</div>
    <div class="sc-guard-then">The github skin draws it as plain text. Nothing fails; it just is not a button.</div>
  </div>
  <div class="sc-guard-item sc-guard-soft">
    <div class="sc-guard-do">You list a command but set no <code>--icon</code></div>
    <div class="sc-guard-then">A button with its label and no glyph. The mask falls back to <code>linear-gradient(transparent, transparent)</code>.</div>
  </div>
  <div class="sc-guard-item sc-guard-hard">
    <div class="sc-guard-do">You style <code>.badge</code> and no JS or HTML writes it</div>
    <div class="sc-guard-then"><code>pnpm check</code> stops: <samp>static/styles/x.css:12  class .badge is styled but no source writes it</samp></div>
  </div>
  <div class="sc-guard-item sc-guard-hard">
    <div class="sc-guard-do">You set <code>--tint-x</code> and nothing reads it</div>
    <div class="sc-guard-then"><code>pnpm check</code> stops: <samp>app: custom property --tint-x is set but never read</samp></div>
  </div>
  <div class="sc-guard-item sc-guard-hard">
    <div class="sc-guard-do">You read <code>var(--nope)</code> that no stylesheet sets</div>
    <div class="sc-guard-then">Stylelint stops on <samp>no-unknown-custom-properties</samp>; the site checks against its own sheets.</div>
  </div>
  <div class="sc-guard-item sc-guard-soft">
    <div class="sc-guard-do">You render a file card outside <code>&lt;pr-file&gt;</code></div>
    <div class="sc-guard-then">No hairline in the terminal skin and no 12px gap in github. No check catches it.</div>
  </div>
</div>`,
        css: `
.sc-guard { display: grid; gap: 8px; max-width: 100%; font: 12px/1.45 var(--sans); color: var(--fg); }
.sc-guard-item { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px 12px; padding: 8px 10px; border: 1px solid var(--line); border-left-width: 4px; border-radius: 6px; background: var(--panel); }
@media (width >= 560px) { .sc-guard-item { grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); } }
.sc-guard-hard { border-left-color: var(--bad); }
.sc-guard-soft { border-left-color: var(--warn); }
.sc-guard-do { font-weight: 600; }
.sc-guard-then { color: var(--fg-muted); }
.sc-guard code, .sc-guard samp { font-family: var(--mono); font-size: 11px; }
.sc-guard samp { display: block; margin-top: 2px; padding: 2px 6px; border-radius: 4px; background: color-mix(in srgb, var(--fg) 6%, var(--panel)); color: var(--fg); white-space: pre-wrap; word-break: break-word; }`,
      },
      micro: null,
      code: [
        {
          path: 'scripts/check-css-usage.mjs',
          lang: 'js',
          diff: `@@ -0,0 +1,135 @@
+// Finds dead CSS that Stylelint cannot see, because the markup is built in JavaScript:
+//   - a class selector whose name appears nowhere in the code that builds the markup;
+//   - a custom property that is set (in CSS, or inline from JS) but never read with var();
+//   - a custom property read with var() in JS that nothing sets.
+// Each scope pairs its stylesheets with the sources that write its markup. A name counts as used
+// when it appears as a whole token in a source, or when a source builds it from a template that
+// starts with its prefix: \`move-\${side}\` covers .move-from, \`var(--s\${n})\` reads --s1 to --s6.
+// Names written by a library at run time go in \`dynamic\`.
+import { readFile } from 'node:fs/promises'
+import { glob } from 'node:fs/promises'
+import path from 'node:path'
+
+const ROOT = path.resolve(import.meta.dirname, '..')
+
+/** @type {Array<{ name: string, css: string[], sources: string[], dynamic: RegExp[] }>} */
+const SCOPES = [
+  {
+    name: 'app',
+    css: ['static/styles/*.css'],
+    sources: ['static/js/**/*.js', 'src/**/*.ts'],
+    // highlight.js writes its token classes at run time.
+    dynamic: [/^hljs(-|$)/, /^(function|class)_$/],
+  },
+  {
+    name: 'site',
+    css: ['site/*.css'],
+    sources: ['site/*.html', 'site/*.js'],
+    dynamic: [/^hljs(-|$)/, /^(function|class)_$/],
+  },`,
        },
        {
          path: 'stylelint.config.mjs',
          lang: 'js',
          diff: `@@ -0,0 +1,35 @@
+export default {
+  extends: ['stylelint-config-standard'],
+  reportNeedlessDisables: true,
+  reportInvalidScopeDisables: true,
+  reportDescriptionlessDisables: true,
+  // Every custom property the app reads must be set in one of its own stylesheets.
+  referenceFiles: ['static/styles/*.css'],
+  rules: {
+    // oxfmt owns blank lines.
+    'at-rule-empty-line-before': null,
+    'comment-empty-line-before': null,
+    'custom-property-empty-line-before': null,
+    'declaration-empty-line-before': null,
+    'rule-empty-line-before': null,
+    // The component files and the GitHub skin override by specificity on purpose, and this rule
+    // compares selectors by their last part without knowing whether they can match the same element.
+    'no-descending-specificity': null,
+
+    'declaration-property-value-no-unknown': true,
+    'no-unknown-animations': true,
+    'no-unknown-custom-media': true,
+    'no-unknown-custom-properties': true,`,
        },
        {
          path: 'browser/theming.spec.ts',
          lang: 'ts',
          diff: `@@ -24,9 +24,10 @@ async function readLook(page: Page) {
       cardHeaderBg: style('section.layer > .layer-h')?.backgroundColor ?? null,
       addedLineBg: style('tr.add:not(.folded) > td.code')?.backgroundColor ?? null,
       stripeHeight: style('.stripe')?.height ?? null,
+      // The closing bracket: the github skin draws icons in ::before, so the probe reads ::after.
       commandBracket: (() => {
         const el = at('.hdr-actions .cmd')
-        return el === null ? null : getComputedStyle(el, '::before').content
+        return el === null ? null : getComputedStyle(el, '::after').content
       })(),
     }
   })`,
        },
      ],
      literate: [
        'The guard is a script and a config, wired into `pnpm check`. The script’s header comment is its spec: three kinds of dead CSS that Stylelint cannot see because the markup is built in JavaScript, and what counts as a use. `SCOPES` pairs each set of stylesheets with the sources that write its markup, and `dynamic` names what a library writes at run time:',
        { chunk: 0 },
        'Stylelint covers what the script does not: a custom property read but set in none of the `referenceFiles`, plus unknown values, animations, and custom media. The nulled rules are the ones where oxfmt owns the blank lines or the skin overrides by specificity on purpose:',
        { chunk: 1 },
        'Both run under one script, and `check` calls it between `lint` and `format:check`, so a stray class or an unread token fails the same command that fails a type error:',
        {
          path: 'package.json',
          lang: 'json',
          diff: `@@ -20,9 +20,10 @@
     "lint": "oxlint --deny-warnings",
     "lint:fix": "oxlint --fix --deny-warnings",
+    "lint:css": "stylelint \\"static/**/*.css\\" \\"site/**/*.css\\" && node scripts/check-css-usage.mjs",
     "format": "oxfmt --write",
     "format:check": "oxfmt --check",
-    "check": "pnpm lint && pnpm format:check && pnpm typecheck",
+    "check": "pnpm lint && pnpm lint:css && pnpm format:check && pnpm typecheck",`,
        },
        'One existing test had to move. The theming probe read the header command’s `::before` for the closing bracket, and `::before` now holds the icon, so it reads `::after`. That is the kind of coupling the scene on this landmark lists: a rule the code depends on, with no check to say so until something breaks:',
        { chunk: 2 },
      ],
      decisions: [],
    },
  ],

  decisions: [
    {
      id: 'd1',
      key: 'purple-marks-here',
      category: 'product',
      landmark: 'l3',
      title: 'Purple for where you are, not the link blue?',
      context:
        'The rail’s current item was blue, the same as links. The skin now paints it purple over the attention tint, and the `Layer n of m` label purple too, so blue means only “a link”.',
      keep: {
        label: 'Purple marks the current place',
        consequence:
          'A reader tells the current layer from a link without reading it. The cost is that purple now carries two meanings, where you are and what needs attention, so the current rail item and the Attention points square share a hue.',
      },
      change: {
        label: 'Blue, as before',
        consequence:
          'The rail keeps the look it had and purple keeps one meaning, attention. The cost is that the current item and a link share a color again, the confusion the change set out to remove.',
      },
      recommended: 'keep',
      reason: {
        text: 'Blue is already spent on links. Purple is ours, and it already marks attention points, so “where you are” joins “what needs you”.',
        place: 'pr',
      },
      anchor: { path: 'static/styles/skin-github.css', line: 539 },
      tryIt: {
        steps: [
          'pnpm install',
          'pnpm start --fixture-canvas __fixtures__/pr-278/review.json',
          'Open http://localhost:3010/review/68?skin=github',
        ],
        look: [
          'The fixture canvas is served for PR 68, whose live head the server fetches, so the page needs your GitHub login.',
          'In the rail, the current layer has a purple bar on its left and a pale purple ground. Press j and k, or scroll: the bar follows the layer in view.',
          'In the layer header, the "Layer 1 of …" label is purple; the title after it is not.',
          'Links in the summary and in points stay blue.',
        ],
      },
      grill: {
        questions: [
          'Which blue for the current rail item: the link blue `--accent`, as before this change, or a new token of its own?',
          'The `Layer n of m` label is purple for the same reason. Does it go back to blue with the rail, or stay purple?',
          'Attention points keep their purple square. Is a purple square beside a blue current item fine with you?',
        ],
        answers: [
          'The link blue, `--accent`, like before the change. No new token.',
          'It follows: blue in both places, one rule.',
          'Yes. The square says what the section holds, not where I am.',
        ],
        restatement: {
          what: 'The rail’s current item and the layer label go back to `--accent` and `--accent-bg`. The `--tint-attention` token stays, since the reviewer note reads it.',
          where: ['static/styles/skin-github.css'],
          unchanged: 'Attention point squares, the note tint, and green for tests and done stay as they are.',
        },
        reverse: {
          question: 'How would you implement it?',
          answer:
            'In skin-github.css, set `.tree a[aria-current]` back to `background: var(--accent-bg); box-shadow: inset 3px 0 0 var(--accent)` in the desktop rule and in the `width <= 1000px` rule, and set `.layer-h .lbl` to `color: var(--accent)`. Leave `--tint-attention` in place, because `.note` still reads it, so check-css-usage stays green. Run `pnpm check` and `pnpm test:browser`.',
        },
      },
    },

    {
      id: 'd2',
      key: 'icon-only-copy-and-ask',
      category: 'product',
      landmark: 'l4',
      title: 'Icon-only for copy and the file ask?',
      context:
        'Copy on a point and ask in a file header are square buttons that show only a glyph; the word stays for screen readers and in a `title` tooltip. Settings, help, skin, and theme in the header get the same treatment.',
      keep: {
        label: 'Icons for the universal verbs',
        consequence:
          'A point’s row and a file header stay short, and the glyphs read the same on every card. The cost is that a first-time reader has to hover or guess what the comment bubble does.',
      },
      change: {
        label: 'Keep the words',
        consequence:
          'Every command says what it does, with no tooltip to discover. The cost is a longer row on each point, a wider file header on narrow screens, and a skin that looks less like GitHub’s toolbars.',
      },
      recommended: 'keep',
      reason: {
        text: 'Copy and ask appear on every point and file. GitHub readers know the copy and comment octicons, and the word is still there for the screen reader and the tooltip.',
        place: 'tour',
      },
      anchor: { path: 'static/styles/skin-github.css', line: 232 },
      tryIt: {
        steps: [
          'pnpm install',
          'pnpm start --fixture-canvas __fixtures__/pr-278/review.json',
          'Open http://localhost:3010/review/68?skin=github',
        ],
        look: [
          'On any attention point, the first button is a square with the copy glyph; hover it for "Copy as Markdown". Post and add to review beside it keep their words.',
          'With AI Chat on, a file header ends with a comment bubble; hover it for "Ask AI Chat about this file".',
          'In the header, settings, help, skin, and theme are squares; the theme one shows a sun, a moon, or a half circle.',
          'Change the URL to ?skin=terminal: the same commands come back as [ copy ] and [ ask ].',
        ],
      },
      grill: {
        questions: [
          'Do the words come back for copy and the file ask only, or for the header’s settings, help, skin, and theme too?',
          'Should the glyph stay in front of the word, like post and add to review, or go entirely?',
          'The two `title` tooltips were added for the icons. Keep them, or drop them with the icons?',
        ],
        answers: [
          'Only copy and the file ask. The header toolbar can stay icons.',
          'Keep the glyph in front of the word, like the other buttons.',
          'Drop them; the word is the label again.',
        ],
        restatement: {
          what: 'Copy on a point and ask in a file header become glyph-plus-word buttons like post and add to review. The header keeps its icon-only toggles.',
          where: ['static/styles/skin-github.css', 'static/js/layers.js', 'static/js/points.js'],
          unchanged: 'The button list, the glyphs, and the header’s icon-only buttons stay as they are.',
        },
        reverse: {
          question: 'How would you implement it?',
          answer:
            'Remove `.findings [data-copy]`, `.ifind [data-copy]`, and `.file-h .cmd` from the icon-only `&:is(...)` block in skin-github.css, so those buttons keep their font size and padding. Drop the `title` argument in points.js and the `title` option in layers.js. Run `pnpm check` and `pnpm test:browser`; the header probe still reads `::after`, so no expectation changes.',
        },
      },
    },

    {
      id: 'd3',
      key: 'hairline-guard',
      category: 'pokayoke',
      landmark: 'l2',
      title: 'Does the file hairline need a guard?',
      context:
        'The base rule `.file + .file` matched nothing for as long as cards were wrapped in `<pr-file>`, and no check noticed. The fix is a new selector and a comment. Nothing fails if the wrapper changes again.',
      keep: {
        label: 'Fix the selector, explain it in a comment',
        consequence:
          'The hairline is back in both skins and the comment in review.css names the wrapper. The cost is that a later markup change can silence it again with no failing check: the usage lint sees class names, not whether a selector can match.',
      },
      change: {
        label: 'Add a look probe for the second card',
        consequence:
          'theming.spec.ts reads the second file card’s top border and top margin, so a dead selector fails the browser suite in every skin. The cost is one more computed-style probe to update whenever the separator changes shape.',
      },
      recommended: 'keep',
      reason: {
        text: 'Each card is wrapped in its own <pr-file>, so the hairline goes between the wrappers.',
        place: 'code',
      },
      anchor: { path: 'static/styles/review.css', line: 424 },
      tryIt: null,
      grill: {
        questions: [
          'Which value should the probe read: the terminal hairline’s `border-top-width`, the github gap’s `margin-top`, or both?',
          'Should it live in `readLook`, which every theming test reads, or in a test of its own?',
          'What should it assert when a review has a single file, so there is no second card?',
        ],
        answers: [
          'Both, in one field, from the same element.',
          'In readLook, so every skin and theme combination checks it.',
          'Nothing special: the fixture there has several files, so null means the selector broke.',
        ],
        restatement: {
          what: 'readLook in theming.spec.ts gains a `fileSeparator` field read from `pr-file + pr-file > .file`: a 1px top border in both skins, a 0px top margin in terminal and 12px in github.',
          where: ['browser/theming.spec.ts'],
          unchanged: 'The selector in review.css and the skin’s gap rule stay as they are.',
        },
        reverse: {
          question: 'How would you implement it?',
          answer:
            'In readLook, add `fileSeparator` from `style("pr-file + pr-file > .file")`, returning `{ border: borderTopWidth, gap: marginTop }` or null. In the skin switch test expect `{ border: "1px", gap: "0px" }` for terminal; in the COMBINATIONS loop expect `gap: "12px"` when the skin is github. A null value fails the match, which is the point. Run `pnpm test:browser --workers=2`.',
        },
      },
    },

    {
      id: 'd4',
      key: 'base-13px',
      category: 'trade-off',
      landmark: 'l3',
      title: '13px base text against readability',
      context:
        'The github skin sets `--fs: 13px` where the base is 14px, and tightens padding in tables, points, headers, and the rail. The overview summary stays at 14px.',
      keep: {
        label: '13px, denser',
        consequence:
          'More of a layer fits on one screen, which is what users asked for. The cost is smaller body text for readers who found 14px comfortable, and two sizes on the page, since the summary keeps 14px.',
      },
      change: {
        label: 'Keep 14px, tighten padding only',
        consequence:
          'Body text stays as readable as before and the page has one size. The cost is fewer rows per screen: part of the density this change was made for is given back.',
      },
      recommended: 'keep',
      reason: {
        text: 'Users asked for a page they can scan. 13px with tighter padding puts more of a layer on one screen, and the summary keeps 14px.',
        place: 'tour',
      },
      anchor: { path: 'static/styles/skin-github.css', line: 21 },
      tryIt: null,
      grill: {
        questions: [
          'Which paddings go back with the size: the table cells, the points, the layer header, the rail, or none?',
          'The summary is 14px on purpose. With the base at 14px, does it stay, or grow to keep the contrast?',
          'Buttons are 12px with a 13px sign-off. Do they follow the base?',
        ],
        answers: [
          'None. Keep every padding change; only `--fs` goes back to 14px.',
          'It stays 14px; one size everywhere is the point.',
          'They stay; the button rule is modeled on GitHub’s btn-sm.',
        ],
        restatement: {
          what: '`--fs` in the github skin goes back to 14px. Every padding and button size from this change stays.',
          where: ['static/styles/skin-github.css'],
          unchanged: 'The summary at 14px, the button sizes, and all tightened paddings stay.',
        },
        reverse: {
          question: 'How would you implement it?',
          answer:
            'Remove the `--fs: 13px` line from `:root[data-skin="github"]` in skin-github.css, so the base 14px applies. Leave `.summary { font-size: 14px }` in place; it is harmless and keeps the intent visible. Run `pnpm check` for the CSS lint and `pnpm test:browser` for the look probes; none of them read the font size, so no expectation changes.',
        },
      },
    },
  ],

  quiz: [
    {
      id: 'q1',
      landmark: 'l1',
      question: 'What problem did readers report that this change set out to fix?',
      options: [
        'Inside a layer, sections and files ran together, so it was hard to tell where one ended and the next began.',
        'The current layer was hard to find in the rail.',
        'Diffs were unreadable in the dark theme.',
      ],
      answer: 0,
      why: 'Tests, attention points, and files had no clear boundaries, and a new file had no top border or space above it. Boxes per section and a card per file are the answer.',
    },
    {
      id: 'q2',
      landmark: 'l3',
      question: 'After this change, what does a color tell you in the github skin?',
      options: [
        'Its severity: red, yellow, and grey for blocker, major, and minor.',
        'One job each: purple is where you are, green is done or the primary action, blue is a link.',
        'Which file type the block belongs to.',
      ],
      answer: 1,
      why: 'The change gives each of the three colors one meaning, so a reader tells the current place, progress, and links apart without reading.',
    },
    {
      id: 'q3',
      landmark: 'l2',
      question: 'Why did the hairline between files never show before, in either skin?',
      options: [
        'Its color was too close to the background.',
        'The rule matched `.file + .file`, but each file card sits inside its own `<pr-file>` wrapper, so the selector never matched anything.',
        'The terminal skin removed it on purpose, and the github skin copied that.',
      ],
      answer: 1,
      why: 'The fix targets the wrappers, `pr-file + pr-file > .file`, which is why the terminal skin got its line back as a side effect.',
    },
  ],

  notToured: [
    {
      title: 'Modern notation across the stylesheets: rgb() with slash alpha, width ranges, currentcolor',
      path: 'static/styles/base.css',
    },
    {
      title:
        'Dead rules removed: .snip, .lbl.divider, the .sq.blocker/.major/.minor severities, the site .muted',
      path: 'static/styles/review.css',
    },
    {
      title: 'The unread --dc on each layer section goes; the rail dot declares its own default',
      path: 'static/styles/layout.css',
    },
    { title: 'Duplicate .brand block merged in the header styles', path: 'static/styles/header.css' },
    {
      title: 'The site’s Stylelint config checks the site tokens against the site stylesheets',
      path: 'site/stylelint.config.mjs',
    },
    { title: 'Lockfile for stylelint and stylelint-config-standard', path: 'pnpm-lock.yaml' },
  ],
}
