// Tour data for PR 67: text at a terminal, JSON on a pipe or with --json.
// Every string a reader sees comes from the diff at 7f7f84e or the pull request description.
// Paths and shas in scenes are synthetic (a repository called acme-widgets).

const SIM_CSS = `
.sc-sim { font-family: var(--sans); color: var(--fg); max-width: 100%; }
.sc-sim-controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; }
.sc-sim-field { border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px 8px; margin: 0; min-width: 0; }
.sc-sim-field legend { font-family: var(--sans); font-size: 0.75rem; color: var(--fg-muted); padding: 0 4px; }
.sc-sim-field label { display: block; font-family: var(--mono); font-size: 0.85rem; padding: 2px 0; cursor: pointer; }
.sc-sim-field input { margin: 0 6px 0 0; accent-color: var(--accent); }
.sc-sim-cmd { font-family: var(--mono); font-size: 0.85rem; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; overflow-wrap: anywhere; }
.sc-sim-prompt { color: var(--accent); margin-right: 6px; }
.sc-sim-streams { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 8px; }
@media (min-width: 600px) { .sc-sim-streams { grid-template-columns: 1fr 1fr; } }
.sc-sim-stream { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; min-width: 0; }
.sc-sim-title { font-size: 0.72rem; color: var(--fg-muted); margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em; }
.sc-sim-lines { margin: 0; font-family: var(--mono); font-size: 0.8rem; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.sc-sim-line-err { color: var(--bad); }
.sc-sim-empty { color: var(--fg-muted); font-style: italic; }
.sc-sim-foot { margin-top: 8px; font-size: 0.85rem; color: var(--fg-muted); }
.sc-sim-exit { font-family: var(--mono); color: var(--fg); margin-right: 8px; }
.sc-sim-exit-bad { color: var(--bad); }
`

const SIM_HTML = `
<div class="sc-sim">
  <div class="sc-sim-controls">
    <fieldset class="sc-sim-field">
      <legend>command</legend>
      <label><input type="radio" name="sc-sim-cmd" value="install-skill" checked> install-skill</label>
      <label><input type="radio" name="sc-sim-cmd" value="clean"> clean --dry-run</label>
      <label><input type="radio" name="sc-sim-cmd" value="insall-skill"> insall-skill</label>
      <label><input type="radio" name="sc-sim-cmd" value="validate"> validate</label>
    </fieldset>
    <fieldset class="sc-sim-field">
      <legend>stdout is</legend>
      <label><input type="radio" name="sc-sim-out" value="tty" checked> a terminal</label>
      <label><input type="radio" name="sc-sim-out" value="pipe"> a pipe</label>
    </fieldset>
    <fieldset class="sc-sim-field">
      <legend>flag</legend>
      <label><input type="checkbox" name="sc-sim-json"> --json</label>
    </fieldset>
  </div>
  <div class="sc-sim-cmd"><span class="sc-sim-prompt">$</span><span data-role="cmdline"></span></div>
  <div class="sc-sim-streams">
    <div class="sc-sim-stream"><p class="sc-sim-title">stdout</p><div class="sc-sim-lines" data-role="stdout"></div></div>
    <div class="sc-sim-stream"><p class="sc-sim-title">stderr</p><div class="sc-sim-lines" data-role="stderr"></div></div>
  </div>
  <p class="sc-sim-foot"><span class="sc-sim-exit" data-role="exit"></span><span data-role="why"></span></p>
</div>
`

/** A model of main, outputMode, printErrorEnvelope, and four commands, as the code at 7f7f84e prints. */
function simInit(root) {
  const REPO = '/home/ana/acme-widgets'
  const HINT = 'run pr-review --help'
  const AGENT_COMMANDS = new Set(['prepare', 'validate', 'publish'])
  const SUBCOMMANDS = new Set(['install-skill', 'clean', 'validate'])
  const CHECKOUT = {
    key: 42,
    sha: '9c4e1f2a7b3d5e6f8a9b0c1d2e3f4a5b6c7d8e9f',
    lastUsedAt: '2026-09-20T14:03:11.000Z',
    dir: `${REPO}/.pr-review/repos/acme__widgets/checkouts/42`,
  }
  const ARGV = {
    'install-skill': ['install-skill'],
    clean: ['clean', '--dry-run'],
    'insall-skill': ['insall-skill'],
    validate: ['validate'],
  }

  function outputMode(command, args, stdoutIsTTY) {
    const rest = args.filter(arg => arg !== '--json')
    const flag = rest.length !== args.length
    const json = command === 'doctor' ? flag : flag || !stdoutIsTTY || AGENT_COMMANDS.has(command)
    return { json, rest, flag }
  }

  function printErrorEnvelope(io, code, message, hint) {
    if (!io.json) {
      io.stderr(`error: ${message} (${code})`)
      if (hint !== undefined) io.stderr(`hint: ${hint}`)
      return
    }
    const error = { code, message }
    if (hint !== undefined) error.hint = hint
    io.stdout(JSON.stringify({ error }))
  }

  const COMMANDS = {
    'install-skill': io => {
      const result = {
        skill: 'pr-review-canvas',
        targets: [
          { kind: 'claude', path: `${REPO}/.claude/skills/pr-review-canvas`, status: 'copied' },
          { kind: 'codex', path: `${REPO}/.agents/skills/pr-review-canvas`, status: 'copied' },
        ],
      }
      if (io.json) {
        io.stdout(JSON.stringify(result))
        return 0
      }
      io.stdout(`Copied the ${result.skill} skill to:`)
      for (const target of result.targets) io.stdout(`  ${target.kind.padEnd(6)}  ${target.path}`)
      return 0
    },
    clean: io => {
      const removed = [CHECKOUT]
      const skipped = []
      const dryRun = true
      if (io.json) {
        const brief = list => list.map(({ key, sha, lastUsedAt, dir }) => ({ key, sha, lastUsedAt, dir }))
        io.stdout(JSON.stringify({ removed: brief(removed), skipped: brief(skipped), dryRun }))
        return 0
      }
      const line = ({ key, sha, lastUsedAt, dir }) =>
        `  ${typeof key === 'number' ? `#${key}` : key} at ${sha.slice(0, 7)}, last used ${lastUsedAt}: ${dir}`
      io.stdout(`Would remove ${removed.length} review checkout${removed.length === 1 ? '' : 's'}:`)
      for (const checkout of removed) io.stdout(line(checkout))
      return 0
    },
    validate: io => {
      // validate with no file: the usage error every command line mistake becomes.
      printErrorEnvelope(
        io,
        'BAD_REQUEST',
        'validate takes one file: pr-review validate <model.json|review.json> --canvas <dir>',
        HINT
      )
      return 2
    },
  }

  function main(argv, stdoutIsTTY) {
    const [command, ...args] = argv
    const { json, flag } = outputMode(command, args, stdoutIsTTY)
    const out = []
    const err = []
    const io = { json, stdout: line => out.push(line), stderr: line => err.push(line) }
    let exit
    if (!SUBCOMMANDS.has(command)) {
      printErrorEnvelope(io, 'BAD_REQUEST', `unknown command: ${command}`, HINT)
      exit = 2
    } else {
      exit = COMMANDS[command](io)
    }
    let why
    if (flag) why = '--json is on the command line, so JSON.'
    else if (!stdoutIsTTY) why = 'stdout is a pipe, so JSON: a script or an agent is reading.'
    else if (AGENT_COMMANDS.has(command)) why = `${command} is an agent command, so JSON even at a terminal.`
    else why = 'A terminal, no flag, not an agent command, so text.'
    return { out, err, exit, why }
  }

  const checked = name => root.querySelector(`input[name="${name}"]:checked`)
  const slot = role => root.querySelector(`[data-role="${role}"]`)

  function fill(target, lines) {
    target.textContent = ''
    if (lines.length === 0) {
      const empty = document.createElement('span')
      empty.className = 'sc-sim-empty'
      empty.textContent = '(nothing)'
      target.append(empty)
      return
    }
    for (const line of lines) {
      const row = document.createElement('div')
      row.textContent = line
      if (line.startsWith('error:') || line.startsWith('hint:')) row.className = 'sc-sim-line-err'
      target.append(row)
    }
  }

  function render() {
    const command = checked('sc-sim-cmd').value
    const pipe = checked('sc-sim-out').value === 'pipe'
    const argv = [...ARGV[command], ...(checked('sc-sim-json') === null ? [] : ['--json'])]
    const result = main(argv, !pipe)
    slot('cmdline').textContent = `pr-review ${argv.join(' ')}${pipe ? ' | cat' : ''}`
    fill(slot('stdout'), result.out)
    fill(slot('stderr'), result.err)
    const exit = slot('exit')
    exit.textContent = `exit ${result.exit}`
    exit.classList.toggle('sc-sim-exit-bad', result.exit !== 0)
    slot('why').textContent = result.why
  }

  root.addEventListener('change', render)
  render()
}

export default {
  key: 67,
  title: 'Print human-readable output for install-skill, export, import, clean, upgrade, and errors',
  repo: 'vintasoftware/pr-review-canvas',
  url: 'https://github.com/vintasoftware/pr-review-canvas/pull/67',
  head: '7f7f84e',
  author: 'fjsj',
  changed: { files: 12, added: 314, removed: 63 },
  mood: 'terminal',
  spec: {
    kind: 'pr-description',
    title: 'PR 67: text at a terminal, JSON on a pipe',
    url: 'https://github.com/vintasoftware/pr-review-canvas/pull/67',
  },

  landmarks: [
    {
      id: 'l1',
      stage: 'world',
      title: 'Text for a person, JSON for a program',
      lead: 'Five commands and every failure now print text at a terminal; a pipe or --json keeps the JSON line that scripts read.',
      body: [
        'Before this change `install-skill` printed a JSON object to whoever ran it, `upgrade` ended with a JSON dump, and a misspelled command printed an error envelope. A person at a terminal read output written for a program.',
        'Now `install-skill`, `export`, `import`, `clean`, and `upgrade` print sentences when stdout is a terminal. Any failure prints `error: <message> (<code>)` and `hint: <hint>` on stderr. With `--json`, or when stdout is a pipe, the old JSON line comes back unchanged, so scripts and agents notice nothing.',
        '`prepare`, `validate`, and `publish` always print JSON, because the skill parses it. `doctor` keeps its checklist, on a pipe too, and prints JSON only with `--json`.',
      ],
      scene: {
        html: `
<div class="sc-l1">
  <table class="sc-l1-table">
    <thead>
      <tr><th>command</th><th>before</th><th>now, at a terminal</th><th>now, on a pipe or with --json</th></tr>
    </thead>
    <tbody>
      <tr><td>install-skill</td><td class="sc-l1-json">JSON</td><td class="sc-l1-text">text</td><td class="sc-l1-json">JSON</td></tr>
      <tr><td>export</td><td class="sc-l1-json">JSON</td><td class="sc-l1-text">text</td><td class="sc-l1-json">JSON</td></tr>
      <tr><td>import</td><td class="sc-l1-json">JSON</td><td class="sc-l1-text">text</td><td class="sc-l1-json">JSON</td></tr>
      <tr><td>clean</td><td class="sc-l1-json">JSON</td><td class="sc-l1-text">text</td><td class="sc-l1-json">JSON</td></tr>
      <tr><td>upgrade</td><td class="sc-l1-json">JSON, plan on stderr</td><td class="sc-l1-text">stderr only</td><td class="sc-l1-json">JSON</td></tr>
      <tr><td>any failure</td><td class="sc-l1-json">{ "error": … } on stdout</td><td class="sc-l1-text">error: and hint: on stderr</td><td class="sc-l1-json">{ "error": … } on stdout</td></tr>
      <tr><td>prepare, validate, publish</td><td class="sc-l1-json">JSON</td><td class="sc-l1-json">JSON</td><td class="sc-l1-json">JSON</td></tr>
      <tr><td>doctor</td><td class="sc-l1-text">checklist</td><td class="sc-l1-text">checklist</td><td class="sc-l1-text">checklist on a pipe, JSON with --json</td></tr>
    </tbody>
  </table>
</div>`,
        css: `
.sc-l1 { max-width: 100%; overflow-x: auto; font-family: var(--sans); color: var(--fg); }
.sc-l1-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; line-height: 1.35; }
.sc-l1-table th, .sc-l1-table td { text-align: left; vertical-align: top; padding: 6px 6px; border-bottom: 1px solid var(--line); }
.sc-l1-table th { font-weight: 600; color: var(--fg-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; }
.sc-l1-table td:first-child { font-family: var(--mono); white-space: nowrap; }
.sc-l1-json { color: var(--accent); }
.sc-l1-text { color: var(--ok); }
`,
      },
      micro: null,
      code: [
        {
          path: 'src/help.ts',
          lang: 'ts',
          diff: `@@ -134,7 +149,8 @@ const SHARED: CommandHelp = {
 }

 const OUTPUT = [
-  'A command prints one JSON line on success, and \`{ "error": { code, message, hint } }\` on failure.',
+  'prepare, validate, and publish print one JSON line. The other one-shot commands print text at a terminal, and one JSON line with --json or when stdout is a pipe.',
+  'A failure prints \`{ "error": { code, message, hint } }\` where the command prints JSON, and an error line on stderr where it prints text.',
   'doctor prints a checklist, for a person or an agent. Pass --json for that same report as one JSON line.',
   'Exit codes: 0 ok, 1 error, 2 usage, 4 gh or glab missing or not logged in, 5 invalid model output.',
 ]`,
        },
        {
          path: 'docs/reference.md',
          lang: 'md',
          diff: `@@ -276,24 +276,32 @@ showed. If the install fails, the current version runs the remaining steps itsel
 ### Output and exit codes

 Help prints to stdout, so \`pr-review --help | less\` works.
-One-shot commands normally print a JSON result on stdout. Preparation progress goes to stderr.
-\`validate --human\` prints text, and a failed \`publish\` prints validation diagnostics before its
-JSON error. \`serve\` stays running and writes its startup message to stderr.
+\`prepare\`, \`validate\`, and \`publish\` print a JSON result on stdout: the skill reads it.
+Preparation progress goes to stderr. \`validate --human\` prints text, and a failed \`publish\` prints
+validation diagnostics before its JSON error. \`serve\` stays running and writes its startup message
+to stderr.
+
+\`install-skill\`, \`export\`, \`import\`, \`clean\`, and \`upgrade\` print text at a terminal. With
+\`--json\`, or when stdout is a pipe, they print the JSON result instead, so scripts and agents
+read the same fields as before.`,
        },
      ],
      literate: [
        'Start where a person first meets the rule: the help text. The `OUTPUT` block in help.ts used to promise one JSON line from every command. It now names the three commands that keep that promise and describes the split for the rest, in two sentences a reader can hold:',
        { chunk: 0 },
        'The reference says the same thing at more length, in the section on output and exit codes. Its first paragraph narrows the JSON promise to `prepare`, `validate`, and `publish`. The new second paragraph gives the five commands their text form and says exactly when the JSON comes back:',
        { chunk: 1 },
        'Everything else in this change is what makes these two paragraphs true. The next landmarks follow the rule from the one function that decides it, to the lines each command prints, to the one command that runs another pr-review.',
      ],
      decisions: [],
    },

    {
      id: 'l2',
      stage: 'why',
      title: 'One decision in main, before any command runs',
      lead: 'outputMode reads the flag, the terminal, and the command name once; every command then asks io.json.',
      body: [
        '`main` strips `--json` from the arguments and calls `outputMode` with the command name and whether stdout is a TTY. The answer lands in `io.json`, the one field every command checks before it prints. No command declares `--json` in its own `parseArgs`, so strict parsing never sees the flag.',
        'The rule has three ways to say JSON: the flag, a stdout that is not a terminal, or a command in `AGENT_COMMANDS`. `doctor` is the exception. Its checklist is written for a person and an agent alike, so only the flag switches it, on a pipe too.',
      ],
      scene: {
        html: `
<div class="sc-l2">
  <svg class="sc-l2-flow" viewBox="0 0 340 372" role="img" aria-label="How outputMode picks text or JSON">
    <defs>
      <marker id="sc-l2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" class="sc-l2-arrowhead"/>
      </marker>
    </defs>
    <rect x="8" y="8" width="204" height="30" rx="5" class="sc-l2-box"/>
    <text x="110" y="27" text-anchor="middle">pr-review &lt;command&gt; …</text>
    <line x1="110" y1="38" x2="110" y2="60" class="sc-l2-edge" marker-end="url(#sc-l2-arrow)"/>

    <rect x="8" y="62" width="204" height="40" rx="5" class="sc-l2-box"/>
    <text x="110" y="86" text-anchor="middle">--json on the command line?</text>
    <line x1="212" y1="82" x2="238" y2="82" class="sc-l2-edge" marker-end="url(#sc-l2-arrow)"/>
    <text x="225" y="76" text-anchor="middle" class="sc-l2-small">yes</text>
    <line x1="110" y1="102" x2="110" y2="124" class="sc-l2-edge" marker-end="url(#sc-l2-arrow)"/>
    <text x="118" y="117" class="sc-l2-small">no</text>

    <rect x="8" y="126" width="204" height="40" rx="5" class="sc-l2-box"/>
    <text x="110" y="143" text-anchor="middle">stdout is a pipe,</text>
    <text x="110" y="158" text-anchor="middle">not a terminal?</text>
    <line x1="212" y1="146" x2="238" y2="146" class="sc-l2-edge" marker-end="url(#sc-l2-arrow)"/>
    <text x="225" y="140" text-anchor="middle" class="sc-l2-small">yes</text>
    <line x1="110" y1="166" x2="110" y2="188" class="sc-l2-edge" marker-end="url(#sc-l2-arrow)"/>
    <text x="118" y="181" class="sc-l2-small">no</text>

    <rect x="8" y="190" width="204" height="40" rx="5" class="sc-l2-box"/>
    <text x="110" y="214" text-anchor="middle">prepare, validate, or publish?</text>
    <line x1="212" y1="210" x2="238" y2="210" class="sc-l2-edge" marker-end="url(#sc-l2-arrow)"/>
    <text x="225" y="204" text-anchor="middle" class="sc-l2-small">yes</text>
    <line x1="110" y1="230" x2="110" y2="252" class="sc-l2-edge" marker-end="url(#sc-l2-arrow)"/>
    <text x="118" y="245" class="sc-l2-small">no</text>

    <rect x="8" y="254" width="204" height="40" rx="5" class="sc-l2-box sc-l2-text"/>
    <text x="110" y="273" text-anchor="middle" class="sc-l2-strong">text, for a person</text>
    <text x="110" y="287" text-anchor="middle" class="sc-l2-small">io.json = false</text>

    <rect x="240" y="62" width="92" height="232" rx="5" class="sc-l2-box sc-l2-json"/>
    <text x="286" y="170" text-anchor="middle" class="sc-l2-strong">JSON</text>
    <text x="286" y="186" text-anchor="middle" class="sc-l2-small">one line</text>
    <text x="286" y="200" text-anchor="middle" class="sc-l2-small">io.json = true</text>

    <rect x="8" y="310" width="324" height="54" rx="5" class="sc-l2-box sc-l2-note"/>
    <text x="18" y="329" class="sc-l2-small">doctor skips the middle two questions:</text>
    <text x="18" y="343" class="sc-l2-small">its checklist prints on a pipe too, and only</text>
    <text x="18" y="357" class="sc-l2-small">--json turns it into the JSON report.</text>
  </svg>
</div>`,
        css: `
.sc-l2 { max-width: 100%; }
.sc-l2-flow { display: block; width: 100%; max-width: 440px; height: auto; margin: 0 auto; font-family: var(--mono); font-size: 11px; }
.sc-l2-flow text { fill: var(--fg); }
.sc-l2-small { font-size: 9.5px; fill: var(--fg-muted) !important; }
.sc-l2-strong { font-size: 12px; font-weight: 600; }
.sc-l2-box { fill: var(--panel); stroke: var(--line); stroke-width: 1; }
.sc-l2-json { stroke: var(--accent); stroke-width: 1.5; }
.sc-l2-text { stroke: var(--ok); stroke-width: 1.5; }
.sc-l2-note { stroke: var(--warn); stroke-dasharray: 3 3; }
.sc-l2-edge { stroke: var(--fg-muted); stroke-width: 1.2; }
.sc-l2-arrowhead { fill: var(--fg-muted); }
`,
      },
      micro: null,
      code: [
        {
          path: 'src/commands.ts',
          lang: 'ts',
          diff: `@@ -43,6 +44,27 @@ import { readText, writeTextAtomic } from './store/atomic-json.js'
 export interface CliIo {
   stdout(line: string): void
   stderr(line: string): void
+  /** Print results and errors as one JSON line instead of text. \`outputMode\` decides it. */
+  json: boolean
+}
+
+/** The steps of review generation: the skill reads their JSON, so they print nothing else. */
+const AGENT_COMMANDS: ReadonlySet<string> = new Set(['prepare', 'validate', 'publish'])
+
+/**
+ * Takes \`--json\` out of a command's arguments and decides whether the command prints JSON: with
+ * the flag, on a stdout that is not a terminal (a script or an agent is reading), or for a command
+ * only an agent runs. doctor prints its checklist on a pipe too, so only the flag switches it.
+ */
+export function outputMode(
+  command: string,
+  args: string[],
+  stdoutIsTTY: boolean
+): { json: boolean; rest: string[] } {
+  const rest = args.filter(arg => arg !== '--json')
+  const flag = rest.length !== args.length
+  const json = command === 'doctor' ? flag : flag || !stdoutIsTTY || AGENT_COMMANDS.has(command)
+  return { json, rest }
 }

 /** Exit codes: 0 ok, 1 error, 2 usage, 4 gh/glab auth or missing, 5 invalid model output. */`,
        },
        {
          path: 'src/cli.ts',
          lang: 'ts',
          diff: `@@ -207,7 +210,9 @@ async function upgradeCommand(argv: string[]): Promise<number> {

 export async function main(argv: string[]): Promise<number> {
   // \`pnpm review -- --port 3011\` forwards the \`--\` itself; drop it so parseArgs sees the flags.
-  const [command, ...rest] = argv.filter(a => a !== '--')
+  const [command, ...args] = argv.filter(a => a !== '--')
+  const { json, rest } = outputMode(command ?? '', args, process.stdout.isTTY === true)
+  io.json = json
   if (command === undefined || command === '--help' || command === '-h') {
     printUsage(process.stdout, readPackageVersion())
     return command === undefined ? EXIT.usage : EXIT.ok`,
        },
      ],
      literate: [
        'The rule lives in one function. `outputMode` takes the command name, its arguments, and whether stdout is a terminal. It pulls `--json` out of the arguments, so no command has to declare the flag, and answers with a boolean and the arguments that remain. The comment above it is the rule in words; the last line of the body is the rule in code:',
        { chunk: 0 },
        'Read the `json` expression from the left. `doctor` is handled first, by name, and gets only the flag. Every other command gets the flag, or a stdout that is not a terminal, or membership in `AGENT_COMMANDS`. The new `json` field on `CliIo` above it is where the answer will live.',
        '`main` calls it once, before it knows which command will run. The answer goes into `io.json`, the shared io object every command receives. `rest` replaces the old argument list, so a command with strict `parseArgs` never sees `--json` and never has to reject it:',
        { chunk: 1 },
        'From here on a command has one question to ask, `io.json`, and never a flag to parse. The two decisions on this landmark are about that shape: whether a pipe should count, and whether one owner is right.',
      ],
      decisions: ['d1', 'd3'],
    },

    {
      id: 'l3',
      stage: 'why',
      title: 'What a person reads, and where failures go',
      lead: 'Success is a sentence on stdout, a failure is an error: line and a hint on stderr, and JSON mode prints what it did before.',
      body: [
        'Each command writes the lines a person needs. `install-skill` lists where the skill went. `export` names the zip. `import` says in one line whether the canvas is ready, stale, or already stored, with any warnings on stderr. `clean` lists what it removed, would remove, or left alone because a chat turn holds it.',
        '`printErrorEnvelope` is the one place a failure is printed. In text mode it writes `error: <message> (<code>)` and, when there is one, `hint: <hint>` on stderr, and nothing on stdout. In JSON mode it prints the same `{ "error": … }` envelope on stdout as before. Exit codes do not change.',
        'Play with the simulator below: pick a command, a terminal or a pipe, and the flag. The two streams show what the code at 7f7f84e prints, with a synthetic repository.',
      ],
      scene: {
        html: `
<div class="sc-l3-term">
  <div class="sc-l3-bar"><span></span><span></span><span></span><em>a terminal, from the pull request description</em></div>
  <pre class="sc-l3-body"><span class="sc-l3-prompt">$</span> pr-review insall-skill
<span class="sc-l3-err">error: unknown command: insall-skill (BAD_REQUEST)</span>
<span class="sc-l3-err">hint: run pr-review --help</span>

<span class="sc-l3-prompt">$</span> pr-review install-skill
Copied the pr-review-canvas skill to:
  claude  /home/ana/acme-widgets/.claude/skills/pr-review-canvas
  codex   /home/ana/acme-widgets/.agents/skills/pr-review-canvas

<span class="sc-l3-prompt">$</span> pr-review clean --dry-run | cat
{"removed":[],"skipped":[],"dryRun":true}</pre>
  <p class="sc-l3-legend"><span class="sc-l3-err">red</span> lines went to stderr; the rest is stdout.</p>
</div>`,
        css: `
.sc-l3-term { max-width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; font-family: var(--mono); color: var(--fg); }
.sc-l3-bar { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-bottom: 1px solid var(--line); }
.sc-l3-bar span { width: 9px; height: 9px; border-radius: 50%; background: var(--line); }
.sc-l3-bar em { font-family: var(--sans); font-style: normal; font-size: 0.72rem; color: var(--fg-muted); margin-left: 6px; }
.sc-l3-body { margin: 0; padding: 10px 12px; font-size: 0.8rem; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.sc-l3-prompt { color: var(--accent); }
.sc-l3-err { color: var(--bad); }
.sc-l3-legend { margin: 0; padding: 6px 12px 8px; font-family: var(--sans); font-size: 0.75rem; color: var(--fg-muted); border-top: 1px solid var(--line); }
`,
      },
      micro: { html: SIM_HTML, css: SIM_CSS, init: simInit },
      code: [
        {
          path: 'src/commands.ts',
          lang: 'ts',
          diff: `@@ -59,7 +81,13 @@ export function printJson(io: CliIo, value: unknown): void {
   io.stdout(JSON.stringify(value))
 }

+/** The failure as the JSON envelope, or as an \`error:\` line and its hint on stderr. */
 export function printErrorEnvelope(io: CliIo, code: ErrorCode, message: string, hint?: string): void {
+  if (!io.json) {
+    io.stderr(\`error: \${message} (\${code})\`)
+    if (hint !== undefined) io.stderr(\`hint: \${hint}\`)
+    return
+  }
   const error: { code: ErrorCode; message: string; hint?: string } = { code, message }
   if (hint !== undefined) {
     error.hint = hint`,
        },
        {
          path: 'src/commands.ts',
          lang: 'ts',
          diff: `@@ -449,7 +485,12 @@ export async function runInstallSkill(env: InstallSkillEnv, argv: string[], io:
     ],
   })
   await ignoreLocalSettings(env.repoRoot)
-  printJson(io, result)
+  if (io.json) {
+    printJson(io, result)
+    return EXIT.ok
+  }
+  io.stdout(\`Copied the \${result.skill} skill to:\`)
+  for (const target of result.targets) io.stdout(\`  \${target.kind.padEnd(6)}  \${target.path}\`)
   return EXIT.ok
 }`,
        },
        {
          path: 'src/commands.ts',
          lang: 'ts',
          diff: `@@ -586,18 +656,31 @@ export async function runClean(ctx: AppContext, argv: string[], io: CliIo): Prom
   const result = await ctx.checkouts.sweep({ all, olderThanDays, dryRun: values['dry-run'] === true })
-  const brief = (list: typeof result.removed) =>
-    list.map(({ key, sha, lastUsedAt, dir }) => ({ key, sha, lastUsedAt, dir }))
-  printJson(io, {
-    removed: brief(result.removed),
-    skipped: brief(result.skipped),
-    dryRun: values['dry-run'] === true,
-  })
+  const dryRun = values['dry-run'] === true
+  if (io.json) {
+    const brief = (list: CheckoutInfo[]) =>
+      list.map(({ key, sha, lastUsedAt, dir }) => ({ key, sha, lastUsedAt, dir }))
+    printJson(io, { removed: brief(result.removed), skipped: brief(result.skipped), dryRun })
+    return EXIT.ok
+  }
+  const checkoutLine = ({ key, sha, lastUsedAt, dir }: CheckoutInfo) =>
+    \`  \${typeof key === 'number' ? \`#\${key}\` : key} at \${shortSha(sha)}, last used \${lastUsedAt}: \${dir}\`
+  if (result.removed.length === 0) {
+    io.stdout('No review checkouts to remove.')
+  } else {
+    const n = plural(result.removed.length, 'review checkout')
+    io.stdout(dryRun ? \`Would remove \${n}:\` : \`Removed \${n}:\`)
+    for (const checkout of result.removed) io.stdout(checkoutLine(checkout))
+  }
+  if (result.skipped.length > 0) {
+    io.stdout(\`Left \${plural(result.skipped.length, 'review checkout')} a chat turn is using:\`)
+    for (const checkout of result.skipped) io.stdout(checkoutLine(checkout))
+  }
   return EXIT.ok`,
        },
      ],
      literate: [
        'Failures first, because every command shares them. `printErrorEnvelope` gains a text branch at the top: when `io.json` is off it writes the `error:` line and, if there is one, the `hint:` line on stderr, then returns before the envelope is built. The JSON path below it is untouched:',
        { chunk: 0 },
        'Then each command gets its sentences. The pattern is the same everywhere: if `io.json`, print the result as before and return; otherwise print lines for a person. `install-skill` is the smallest case, one heading and one line per target:',
        { chunk: 1 },
        '`export` and `import` follow the same shape. Export names the zip it wrote. Import prints its warnings on stderr and one line from `describeImport`, a new function that turns the result status into a sentence: the canvas is ready, or stale by so many commits, or was already stored and kept:',
        {
          path: 'src/commands.ts',
          lang: 'ts',
          diff: `@@ -550,12 +595,37 @@ export async function runImport(ctx: AppContext, argv: string[], io: CliIo): Pro
-  printJson(io, await importCanvas(ctx, options))
+  const result = await importCanvas(ctx, options)
+  if (io.json) {
+    printJson(io, result)
+    return EXIT.ok
+  }
+  for (const warning of result.warnings) io.stderr(\`warning: \${warning}\`)
+  io.stdout(describeImport(result))
   return EXIT.ok
 }

+/** One line on what an import did, for a person reading the terminal. */
+export function describeImport(result: ImportResult): string {
+  const canvas = shortSha(result.headSha)
+  if (result.status === 'exists') {
+    return \`A canvas for \${canvas} is already stored and is at least as new; kept it.\`
+  }
+  if (result.status === 'ready') {
+    return \`Imported the canvas for \${canvas}.\`
+  }
+  const head = shortSha(result.currentHeadSha)
+  const behind =
+    result.relation === 'ancestor' && result.commitsBehind !== undefined
+      ? \`, \${plural(result.commitsBehind, 'commit')} ahead of it\`
+      : result.relation === 'unrelated'
+        ? ', which does not contain it'
+        : ''
+  return \`Imported the canvas for \${canvas}, but the head is now \${head}\${behind}. The canvas is stale.\`
+}`,
        },
        '`clean` is the longest, because it has three things to say: nothing to remove, what it removed or would remove, and what it left alone because a chat turn still holds it. The JSON branch keeps the exact object it printed before:',
        { chunk: 2 },
        'The simulator on this landmark runs a model of exactly these branches, so you can see each sentence and each envelope land on its stream.',
      ],
      decisions: ['d4'],
    },

    {
      id: 'l4',
      stage: 'why',
      title: 'upgrade talks to a person and to its own child',
      lead: 'The plan and each step go to stderr; the child upgrade runs with --json on a pipe, and the parent reads its last line.',
      body: [
        "`upgrade` already wrote its plan and the confirmation on stderr. Now each step's outcome and the closing line, `Upgrade complete.` or `Upgrade finished with failed steps; see above.`, go there too. At a terminal stdout stays empty. With `--json`, or on a pipe, stdout gets the one JSON line with `applied`, `ok`, and the steps.",
        "Once pr-review itself is upgraded, the parent hands the rest to the new version: `upgrade --yes --json --only acpx,skill`. The child runs under `execFile`, so its stdout is a pipe and the pipe rule already means JSON. The parent parses the last stdout line and prints the child's steps as its own. An older parent, from before this change, passes no flag and still gets JSON from a newer child.",
      ],
      scene: {
        html: `
<div class="sc-l4">
  <ol class="sc-l4-line">
    <li class="sc-l4-parent"><span class="sc-l4-who">parent 0.5.0</span><span class="sc-l4-what"><b>stderr</b> pr-review upgrade will: … Proceed? [y/N]</span></li>
    <li class="sc-l4-parent"><span class="sc-l4-who">parent</span><span class="sc-l4-what"><b>runs</b> npm install -g @vintasoftware/pr-review-canvas@0.6.0</span></li>
    <li class="sc-l4-parent"><span class="sc-l4-who">parent</span><span class="sc-l4-what"><b>execFile</b> pr-review upgrade --yes --json --only acpx,skill --repo …</span></li>
    <li class="sc-l4-child"><span class="sc-l4-who">child 0.6.0</span><span class="sc-l4-what"><b>stdout is a pipe</b>, and --json is set: JSON either way. Plans again with its own code.</span></li>
    <li class="sc-l4-child"><span class="sc-l4-who">child</span><span class="sc-l4-what"><b>stdout</b> {"applied":true,"ok":true,"steps":[…],"notes":[…]}</span></li>
    <li class="sc-l4-parent"><span class="sc-l4-who">parent</span><span class="sc-l4-what"><b>parses</b> the last stdout line, then <b>stderr</b> done: upgrade acpx 0.13.2 -> 0.19.1 (npm install -g acpx@0.19.1)</span></li>
    <li class="sc-l4-parent"><span class="sc-l4-who">parent</span><span class="sc-l4-what"><b>stderr</b> Upgrade complete. <b>stdout</b> nothing at a terminal; one JSON line with --json or on a pipe.</span></li>
  </ol>
</div>`,
        css: `
.sc-l4 { max-width: 100%; font-family: var(--sans); color: var(--fg); }
.sc-l4-line { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid var(--line); }
.sc-l4-line li { position: relative; padding: 0 0 12px 12px; font-size: 0.82rem; line-height: 1.4; }
.sc-l4-line li::before { content: ''; position: absolute; left: -21px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: var(--panel); border: 2px solid var(--fg-muted); }
.sc-l4-child::before { border-color: var(--accent) !important; }
.sc-l4-who { display: block; font-family: var(--mono); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-muted); }
.sc-l4-child .sc-l4-who { color: var(--accent); }
.sc-l4-what { display: block; font-family: var(--mono); overflow-wrap: anywhere; }
.sc-l4-what b { font-family: var(--sans); font-weight: 600; color: var(--fg); }
`,
      },
      micro: null,
      code: [
        {
          path: 'src/upgrade.ts',
          lang: 'ts',
          diff: `@@ -210,6 +210,7 @@ async function handOff(deps: UpgradeDeps, kinds: StepKind[]): Promise<StepOutcom
   const result = await deps.runInstalled([
     'upgrade',
     '--yes',
+    '--json',
     '--only',
     kinds.join(','),
     ...(deps.repoRoot === null ? [] : ['--repo', deps.repoRoot]),`,
        },
        {
          path: 'src/upgrade.ts',
          lang: 'ts',
          diff: `@@ -333,6 +334,10 @@ export async function runUpgrade(deps: UpgradeDeps, argv: string[], io: CliIo):
     io.stderr(\`The project skill changed. Commit and push \${refreshed.join(' and ')} so your team gets it.\`)
   }
   const ok = outcomes.every(o => o.status !== 'failed')
-  printJson(io, { applied: true, ok, steps: outcomes, notes: plan.notes })
+  if (io.json) {
+    printJson(io, { applied: true, ok, steps: outcomes, notes: plan.notes })
+  } else {
+    io.stderr(ok ? 'Upgrade complete.' : 'Upgrade finished with failed steps; see above.')
+  }
   return ok ? EXIT.ok : EXIT.error
 }`,
        },
        {
          path: 'src/upgrade.test.ts',
          lang: 'ts',
          diff: `@@ -86,10 +86,12 @@ function fake(opts: {
     runInstalled: async args => {
       calls.push(\`pr-review \${installed[NAME]} \${args.join(' ')}\`)
       if (opts.garbledInstalled) return { ok: false, stdout: 'Segmentation fault', stderr: 'boom' }
-      // What cli.ts does with the arguments: the command name, then the common flags.
-      const [command, ...flags] = args
+      // What cli.ts does with the arguments: the command name, the output mode on the pipe
+      // execFile gives the child, then the common flags.
+      const [command = '', ...commandArgs] = args
+      const { json, rest: flags } = outputMode(command, commandArgs, false)
       const { repo: childRepo, rest } = splitCommonFlags(flags)
-      const child = capture()
+      const child = capture(json)`,
        },
      ],
      literate: [
        '`upgrade` is the one command that runs another pr-review, so it has to speak both languages. Two edits in upgrade.ts. First, the handoff line passes `--json` to the newly installed child, right after `--yes`:',
        { chunk: 0 },
        'Second, the end of `runUpgrade`. Where it printed the report unconditionally, it now prints it only in JSON mode, and otherwise closes with one line on stderr, where the plan and each step already went:',
        { chunk: 1 },
        'The test fake had to learn the rule the real cli.ts applies. It used to hand the child every argument as flags. Now it runs `outputMode` with `stdoutIsTTY` set to false, which is what `execFile` gives a child, and captures the child in the mode that produces:',
        { chunk: 2 },
        'That `false` is the whole reason an older parent still works. Even when the parent never passes the flag, the pipe alone makes the child print JSON, and the parent reads its last stdout line as before. The decision here asks whether the explicit flag is worth keeping on top of that.',
      ],
      decisions: ['d2'],
    },

    {
      id: 'l5',
      stage: 'respect',
      title: 'What a new command must respect',
      lead: 'Ask io.json, print failures through printErrorEnvelope, keep stdout to one line in JSON mode, and name agent commands in one set.',
      body: [
        "A new one-shot command never parses `--json` itself: `main` has removed it and set `io.json`. It prints results as lines on stdout in text mode, and exactly one JSON line in JSON mode, because `upgrade`'s parent reads the last line of a child's stdout. Every failure goes through `printErrorEnvelope`, so it lands on stderr as text or on stdout as JSON.",
        'A command the skill parses belongs in `AGENT_COMMANDS`; there is no other way to force JSON at a terminal. `doctor` is the one command coded by name in `outputMode`. A test fake for `CliIo` must now set `json`, which is why three unrelated test files changed.',
      ],
      scene: {
        html: `
<div class="sc-l5">
  <div class="sc-l5-card"><div class="sc-l5-k">io.json</div><p>Set once by main. Read it before you print. Never declare --json in a command's parseArgs.</p></div>
  <div class="sc-l5-card"><div class="sc-l5-k">printErrorEnvelope</div><p>Every failure goes through it: error: and hint: on stderr as text, the envelope on stdout as JSON.</p></div>
  <div class="sc-l5-card"><div class="sc-l5-k">one line</div><p>In JSON mode stdout holds exactly one line. The upgrade parent parses the last line of its child.</p></div>
  <div class="sc-l5-card"><div class="sc-l5-k">AGENT_COMMANDS</div><p>prepare, validate, publish. A new command the skill parses is added here, nowhere else.</p></div>
  <div class="sc-l5-card sc-l5-warn"><div class="sc-l5-k">doctor</div><p>The one name coded in outputMode: checklist on a pipe, JSON only with --json. Do not copy this for a new command.</p></div>
  <div class="sc-l5-card"><div class="sc-l5-k">CliIo fakes</div><p>A test io needs json: true or false. TypeScript refuses a fake without it.</p></div>
</div>`,
        css: `
.sc-l5 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; max-width: 100%; font-family: var(--sans); color: var(--fg); }
.sc-l5-card { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; min-width: 0; }
.sc-l5-card p { margin: 4px 0 0; font-size: 0.78rem; line-height: 1.4; overflow-wrap: anywhere; }
.sc-l5-k { font-family: var(--mono); font-size: 0.8rem; font-weight: 600; color: var(--accent); overflow-wrap: anywhere; }
.sc-l5-warn { border-color: var(--warn); }
.sc-l5-warn .sc-l5-k { color: var(--warn); }
`,
      },
      micro: null,
      code: [
        {
          path: 'src/cli.ts',
          lang: 'ts',
          diff: `@@ -47,9 +48,11 @@ const SUBCOMMANDS = [
   'clean',
 ] as const

+/** Filled in by main once it knows the command line. */
 const io: CliIo = {
   stdout: line => process.stdout.write(\`\${line}\\n\`),
   stderr: line => process.stderr.write(\`\${line}\\n\`),
+  json: true,
 }

 async function buildContext(`,
        },
        {
          path: 'src/commands.ts',
          lang: 'ts',
          diff: `@@ -411,11 +447,11 @@ export async function runDoctor(
 ): Promise<number> {
   const { values } = parseArgs({
     args: argv,
-    options: { 'all-checks': { type: 'boolean' }, json: { type: 'boolean' } },
+    options: { 'all-checks': { type: 'boolean' } },
     strict: true,
   })
   const report = await runDoctorChecks(deps, { allChecks: values['all-checks'] === true })
-  if (values.json === true) {
+  if (io.json) {
     printJson(io, report)
   } else {
     printDoctorReport(report, output)`,
        },
        {
          path: 'skills/pr-review-canvas/SKILL.md',
          lang: 'md',
          diff: `@@ -219,12 +219,12 @@ For a \`--base/--head\` run, \`sharing.status\` is \`"local"\` too, but the canvas has
 own. Report the stored commit and export it:

 \`\`\`bash
-pr-review export --head <headSha>
+pr-review export --head <headSha> --json
 \`\`\`

 Export prints \`{ "status": "exported", "path", "name", "headSha", "prNumber" }\`; \`prNumber\``,
        },
      ],
      literate: [
        'What must stay true is easiest to see in three small edits. The shared `io` in cli.ts starts with `json: true`, and the comment says who fills it in. Because the field is now part of `CliIo`, a test fake that builds one has to say which mode it is in, which is why three unrelated test files changed:',
        { chunk: 0 },
        '`doctor` shows what a command must not do anymore: declare `json` in its own `parseArgs`. Its option is gone, and the branch reads `io.json` like everyone else. Its exception, checklist on a pipe, lives in `outputMode`, not here:',
        { chunk: 1 },
        'And the skill, the one reader that parses `export`, now asks for JSON explicitly rather than relying on the pipe. It costs nothing and keeps working if the pipe rule ever changes:',
        { chunk: 2 },
        'A new command copies doctor’s branch, never its old option; prints exactly one line in JSON mode, because the upgrade parent reads the last one; fails through `printErrorEnvelope`; and joins `AGENT_COMMANDS` only if the skill parses it.',
      ],
      decisions: [],
    },
  ],

  decisions: [
    {
      id: 'd1',
      key: 'pipe-means-json',
      category: 'trade-off',
      landmark: 'l2',
      title: 'Does a pipe mean JSON?',
      context:
        '`outputMode` prints JSON when stdout is not a terminal, so a script that never passed `--json` keeps getting the line it parsed before. The same rule turns `pr-review clean | less` into JSON for a person.',
      keep: {
        label: 'A pipe means JSON',
        consequence:
          'Every existing script, agent, and the older `upgrade` parent keep working with no flag. A person who pipes into `less`, `tee`, or a log file gets JSON, and CI logs show JSON too.',
      },
      change: {
        label: 'Only --json means JSON',
        consequence:
          'Piping into `less` or a log file shows text. Every script and agent that reads these commands must add `--json` now, and an older `upgrade` parent that hands off to this version would read text and report a failed step.',
      },
      recommended: 'keep',
      reason: {
        text: 'Scripts and agents never passed a flag; they read the JSON line. A pipe keeps that contract without a release note nobody reads.',
        place: 'pr',
      },
      anchor: { path: 'src/commands.ts', line: 66 },
      tryIt: null,
      grill: {
        questions: [
          'Which readers pipe these commands today without passing --json: the skill, the upgrade handoff, or user scripts you know of?',
          'An older pr-review hands off to a newer one over a pipe with no --json. Should that parent get text and fail, or does upgrade keep the pipe rule?',
          'Does doctor stay as it is, checklist on a pipe, or does every command follow the one rule?',
        ],
        answers: [
          'The skill and the handoff pass --json now. I only know of my own shell aliases, which I can update.',
          'Keep the pipe rule for the upgrade child only; everything else needs the flag.',
          'doctor stays as it is.',
        ],
        restatement: {
          what: 'A pipe no longer implies JSON. `--json` is the only switch, except for `upgrade`, which still prints JSON on a pipe so an older parent can read it.',
          where: ['src/commands.ts', 'src/commands.test.ts', 'src/help.ts', 'docs/reference.md'],
          unchanged:
            'prepare, validate, and publish always print JSON, and doctor prints its checklist unless --json is passed.',
        },
        reverse: {
          question: 'How would you implement it?',
          answer:
            'Drop `!stdoutIsTTY` from the `json` expression in `outputMode`, and add a check for `command === \'upgrade\'` that keeps the pipe rule there. Update the help line and docs/reference.md so they no longer say "or when stdout is a pipe", and rewrite the outputMode test so `clean --dry-run` on a pipe expects text. The handoff keeps passing `--json`, so the parent side needs no change.',
        },
      },
    },

    {
      id: 'd2',
      key: 'handoff-passes-json',
      category: 'pokayoke',
      landmark: 'l4',
      title: 'Should the handoff pass --json when the pipe already implies it?',
      context:
        "`handOff` runs the newly installed pr-review through `execFile`, so the child's stdout is a pipe and the pipe rule already gives JSON. The change passes `--json` too, and the parent reads the last stdout line as the report.",
      keep: {
        label: 'Pass --json explicitly',
        consequence:
          "The parent's read of the report never depends on the pipe rule, so changing that rule later cannot break upgrade. The cost is a redundant flag, and one more argument the child must keep accepting.",
      },
      change: {
        label: 'Rely on the pipe alone',
        consequence:
          'One less argument, and the handoff line matches what an older parent sends. The report then depends on a rule in another function, and the first person to make a pipe print text breaks upgrade without touching upgrade.ts.',
      },
      recommended: 'keep',
      reason: {
        text: "The parent parses the child's stdout. That must hold even if the pipe rule changes, so the handoff asks for JSON itself.",
        place: 'code',
      },
      anchor: { path: 'src/upgrade.ts', line: 213 },
      tryIt: null,
      grill: {
        questions: [
          'What should the parent do when the child prints text instead of JSON: fail the skill step, as it does now, or retry with --json?',
          'Do you also want the tests that pin the handoff arguments to drop --json, so nobody adds it back by habit?',
        ],
        answers: [
          'Fail the step as now; the pipe rule makes text impossible anyway.',
          'Yes, drop it from the tests too.',
        ],
        restatement: {
          what: "The handoff stops passing --json and relies on the child's piped stdout for its JSON report.",
          where: ['src/upgrade.ts', 'src/upgrade.test.ts'],
          unchanged:
            'The child still prints its report as one JSON line on a pipe, and the parent still parses the last stdout line.',
        },
        reverse: {
          question: 'How would you implement it?',
          answer:
            "Remove the `'--json'` element from the array `handOff` passes to `deps.runInstalled`, and update the two `calls` expectations in upgrade.test.ts that spell out the handoff line. The fake `runInstalled` in that test already computes the child's mode with `outputMode(command, args, false)`, so the child still prints JSON and the test still parses it.",
        },
      },
    },

    {
      id: 'd3',
      key: 'one-owner-for-json',
      category: 'architecture',
      landmark: 'l2',
      title: 'Where is --json parsed?',
      context:
        '`main` calls `outputMode` once: it removes `--json` from the arguments and sets `io.json` before any command parses its flags. No command declares `json` in its own `parseArgs`, and `doctor` lost the one it had.',
      keep: {
        label: 'One owner in main',
        consequence:
          'A new command supports --json without declaring it, and strict parsing never rejects the flag. Every command accepts --json, even `serve`, where it does nothing, and help lists it only where it matters.',
      },
      change: {
        label: 'Each command declares --json',
        consequence:
          "A command's flags are all in its own `parseArgs`, and `serve --json` is a usage error. Every command must declare it, and a forgotten one rejects --json with a usage error instead of printing JSON.",
      },
      recommended: 'keep',
      reason: {
        text: 'The output mode is one fact about the run, known before the command runs. One function owns it, so no command can forget the flag.',
        place: 'code',
      },
      anchor: { path: 'src/commands.ts', line: 59 },
      tryIt: null,
      grill: {
        questions: [
          'Which commands should reject --json: serve only, or also prepare, validate, and publish, which always print JSON?',
          'Should the mode still live on io.json, set by each command after it parses, or become a parameter of every run function?',
          'doctor had its own json option before this change. Does it get it back the same way as the others?',
        ],
        answers: [
          'serve only; the agent commands can keep accepting it.',
          'Keep io.json; each command sets it right after parsing.',
          'Yes, doctor declares json again like the others.',
        ],
        restatement: {
          what: 'Each one-shot command declares `--json` in its own parseArgs and sets `io.json` from it plus the pipe rule; `serve --json` becomes a usage error.',
          where: ['src/cli.ts', 'src/commands.ts', 'src/upgrade.ts', 'src/commands.test.ts'],
          unchanged:
            'The pipe rule, the agent commands, the doctor exception, and every printed line stay as they are.',
        },
        reverse: {
          question: 'How would you implement it?',
          answer:
            "Cut the argument filtering from `outputMode` so it takes a `flag` boolean and only decides. Add `json: { type: 'boolean' }` to the parseArgs options of doctor, install-skill, export, import, clean, and upgrade; each calls `outputMode` with its parsed flag and `process.stdout.isTTY`, then assigns `io.json`. `serve` declares nothing, so strict parsing rejects --json there. Update the outputMode tests to the new signature.",
        },
      },
    },

    {
      id: 'd4',
      key: 'error-line-shows-code',
      category: 'product',
      landmark: 'l3',
      title: 'Does the error line show the code?',
      context:
        'At a terminal a failure prints `error: <message> (<code>)` and `hint: <hint>` on stderr. The code in parentheses is the same `BAD_REQUEST` or `NOT_A_REPO` the JSON envelope carries.',
      keep: {
        label: 'Message, then the code in parentheses',
        consequence:
          "A person can search the reference or a bug report for the exact code, and the text and JSON forms name the same failure. The line reads like a program's insides, and `(BAD_REQUEST)` says nothing to someone who typed a command wrong.",
      },
      change: {
        label: 'Message and hint only',
        consequence:
          'The line reads like a sentence: `error: unknown command: insall-skill`. The code exists only in JSON, so a person reporting a failure has to rerun with --json to name it.',
      },
      recommended: 'keep',
      reason: {
        text: 'The code is the name of the failure in the docs and in the JSON. A person who pastes the line into an issue should carry it along.',
        place: 'tour',
      },
      anchor: { path: 'src/commands.ts', line: 87 },
      tryIt: {
        steps: [
          'pnpm install',
          'node bin/pr-review.mjs insall-skill; echo "exit $?"',
          'node bin/pr-review.mjs insall-skill --json',
          'node bin/pr-review.mjs insall-skill 2>/dev/null | cat',
          'node bin/pr-review.mjs clean --dry-run',
          'node bin/pr-review.mjs clean --dry-run | cat',
        ],
        look: [
          'The first run prints two lines on stderr, error: with the code in parentheses and hint:, and exits 2.',
          'With --json the same failure is one JSON envelope on stdout, and stderr is empty.',
          'On a pipe the envelope goes to stdout too, so 2>/dev/null hides nothing.',
          'clean prints a sentence at the terminal and the JSON line through cat. Nothing is removed: --dry-run.',
        ],
      },
      grill: {
        questions: [
          'Where does a person find the code once it leaves the line: does the hint name it, or does only --json carry it?',
          'The doctor checklist already prints failures as words with a hint. Should the error line match that voice exactly?',
        ],
        answers: [
          'Only --json carries it; the hint and the docs are enough for a person.',
          'Yes, the same voice as doctor.',
        ],
        restatement: {
          what: 'The terminal error line drops the code: `error: <message>` and `hint: <hint>`. The JSON envelope keeps `code`.',
          where: ['src/commands.ts', 'src/commands.test.ts', 'docs/reference.md'],
          unchanged:
            'Failures still go to stderr at a terminal and to stdout as JSON otherwise; exit codes do not change.',
        },
        reverse: {
          question: 'How would you implement it?',
          answer:
            'In `printErrorEnvelope`, change the text branch to print `error: ${message}` and leave the hint line as it is. Update the "failures at a terminal" test to expect `error: nope` and to drop the regex that matches `(INTERNAL)`. Change the sentence in docs/reference.md that spells out the `error: <message> (<code>)` form.',
        },
      },
    },
  ],

  quiz: [
    {
      id: 'q1',
      landmark: 'l2',
      question:
        'A cron job runs `pr-review clean` with stdout redirected to a log file. What lands in the log?',
      options: [
        '"Removed 1 review checkout:" and one line per checkout',
        'One JSON line with removed, skipped, and dryRun',
        'Nothing: the list goes to stderr',
      ],
      answer: 1,
      why: 'A file is not a terminal, so outputMode picks JSON: the same line the command printed before this change.',
    },
    {
      id: 'q2',
      landmark: 'l3',
      question: 'At a terminal, a person runs `pr-review insall-skill 2>/dev/null`. What do they see?',
      options: [
        'error: unknown command: insall-skill (BAD_REQUEST), then the hint',
        'Nothing: in text mode the failure goes to stderr, which they discarded',
        'The JSON envelope on stdout',
      ],
      answer: 1,
      why: 'Text mode puts failures on stderr and nothing on stdout; add --json, or pipe stdout, to get the envelope on stdout instead.',
    },
    {
      id: 'q3',
      landmark: 'l4',
      question:
        'A pr-review from before this change upgrades itself and hands off to the new version without passing --json. What does the old parent read from the child?',
      options: [
        'Text lines, so the parent reports that the new pr-review did not report a result',
        "One JSON line: the child's stdout is a pipe, and a pipe means JSON",
        'Nothing: the new child refuses to run without --json',
      ],
      answer: 1,
      why: 'execFile gives the child a pipe, so outputMode picks JSON in the child even when the parent never asked for it.',
    },
  ],

  notToured: [
    { title: 'Changelog entry for the new rule', path: 'CHANGELOG.md' },
    { title: 'Reference: the upgrade section and the output rules in full', path: 'docs/reference.md' },
    { title: 'The skill passes --json to export', path: 'skills/pr-review-canvas/SKILL.md' },
    {
      title: 'Unit tests for the text output of each command and describeImport',
      path: 'src/commands.test.ts',
    },
    { title: 'Upgrade tests: the handoff line and terminal output', path: 'src/upgrade.test.ts' },
    {
      title: 'Test fakes that now set io.json (also doctor-view.test.ts, release-06-adversarial.test.ts)',
      path: 'src/review/doctor.test.ts',
    },
  ],
}
