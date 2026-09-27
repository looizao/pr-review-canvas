# PR Review Canvas

Review GitHub pull requests and GitLab merge requests with diffs grouped by topic,
attention points, comments, and optional AI chat. The review app runs locally at
**http://localhost:3010**.

## Install

You need Node.js 22+, npm, Git, and the CLI for your host:

- GitHub: [GitHub CLI](https://cli.github.com). Sign in with `gh auth login`.
- GitLab: [GitLab CLI (glab)](https://gitlab.com/gitlab-org/cli). Sign in with `glab auth login`.
  For self-hosted GitLab whose hostname does not contain `gitlab`, set `PR_REVIEW_HOST=gitlab`.

Install the command globally:

```bash
npm install -g @vintasoftware/pr-review-canvas
```

To update an existing installation and its project skills, run `pr-review upgrade` from
that project. See [upgrade options](docs/reference.md#upgrade-options).

## Set up a project

Run these commands in the repository you want to review:

```bash
cd /path/to/your-project
pr-review install-skill
pr-review doctor --all-checks
```

`install-skill` installs the generation skill for Claude Code and Codex in
`.claude/skills/pr-review-canvas` and `.agents/skills/pr-review-canvas`.
Commit these copies so your team can use them. Restart your coding agent if the skill
does not appear. Repeat this setup for each project.

`doctor --all-checks` checks your repository, host CLI login, local storage, installed
skills, and `acpx` for AI Chat. Follow any hints it prints to fix failed checks.
If only `acpx` is missing, you can still review canvases; install it below to enable chat.

### Optional: AI Chat install

To ask questions about a PR inside the canvas, install `acpx` globally:

```bash
npm install -g acpx@latest
acpx --version
pr-review doctor --all-checks
```

Install and sign in to Claude Code or Codex on the same machine. Start or restart the
review server, then choose the **Chat agent** in **settings**. Chat uses that agent's account.
See [AI Chat](docs/reference.md#ai-chat) for model settings and review checkouts.

## Generate and review a canvas

### Settle your decisions first: the self-review deck

A canvas explains a change. The self-review deck makes you decide it. Run:

```text
/pr-self-review branch            # or: /pr-self-review uncommitted, or /pr-self-review <pr-number>
```

The skill writes a short deck of **decision cards**, at most one per 100 changed lines and never
more than ten. Each card is one choice your change makes that a reasonable engineer could make
either way, such as handling a rare case or simplifying, or keeping backwards compatibility or
breaking cleanly. Each card has two sides, A and B, and marks the one the code does now. The
card shows each side's consequence in a sentence and a picture of where it lands: the screen, the
terminal, the caller's code, a chart, or an animated diagram. `i` turns the card over to the
reasons and the code. Before publishing, the skill runs `pr-review deck preview`, which
screenshots every card with your installed Chrome, Chromium, or Edge, so it can look at what it
drew. Open **http://localhost:3010/deck/branch** (or `/deck/uncommitted`, or `/deck/<pr-number>`)
and work through the cards one at a time. At 1080p and above, the page never scrolls; on a phone the sides stack and you tap or drag.
A pull request works too: its head comes from the forge, so fixes reach the next deck once they
are pushed.

| Key       | Action                                                      |
| --------- | ----------------------------------------------------------- |
| `a` / `b` | pick side A (left) or side B (right), or drag the card      |
| `n`       | neither side: say what you want instead                     |
| `s`       | skip: leave the decision to reviewers                       |
| `u`       | undo the last pick                                          |
| `e` / `r` | edit a side's justification, or change where it is recorded |
| `i`       | turn the card over: context, justifications, and the code   |

When the deck is cleared, the page writes a **fix list** from every pick that disagrees with the
code, and suggests the next command:

```text
/pr-self-review-fix branch
```

It asks you about anything unclear, applies the fixes, writes the justifications you marked for
the code, then deals a fresh deck. Decisions you already settled are carried over and never asked
again, so the next deck shows only the questions the fixes raised.

When you then generate the pull request's canvas (`/pr-review-canvas <n>`), it takes what the
decks for that pull request, or for its branch, settled. The canvas does not ask a settled decision
again unless the code contradicts your pick; then the point is marked yours, to fix or to
resolve. It raises the cards you skipped as reviewer points. Publishing it also posts every **PR
comment** justification as your own review, one comment on the code each concerns. Pass
`--skip-self-review-comments` to `pr-review publish` to keep them off; `sharing.canvasComment:
false` keeps them off too. See [self-review deck](docs/reference.md#self-review-deck) for the
commands and the rules the canvas is held to.

### Self-reviewing your PRs

Run the installed skill in Claude Code or Codex, replacing `123` with your PR or MR number:

```text
/pr-review-canvas 123
```

The skill generates and validates the canvas, then shares it in a PR or MR comment using
your `gh` or `glab` login. It returns a local review URL and the comment link.
If you dealt a [self-review deck](#settle-your-decisions-first-the-self-review-deck) first, the
canvas takes the decisions it settled.
Anyone with access to the PR or MR can read the shared canvas.

Start the server from your project:

```bash
pr-review serve
```

Open the review URL. For each attention point marked **yours**, click **resolve** and
explain why it needs no reviewer decision. Your reason stays visible to reviewers.
Then request review from your team.

After pushing new commits, run `/pr-review-canvas 123` again to update the canvas.
Reviewers click **refresh** to load it.

See [self-review](docs/reference.md#self-review) for resolution details and
[manual sharing](docs/reference.md#automatic-sharing-and-zip-fallback) if automatic sharing fails.

Before opening a PR, you can generate a canvas for your local work:

```text
/pr-review-canvas branch          # the current branch against the default branch
/pr-review-canvas uncommitted     # includes working-tree edits and new files
```

With `pr-review serve` running, open **http://localhost:3010/review/branch** or
**http://localhost:3010/review/uncommitted**. These reviews stay local, and you can resolve
attention points before sharing your work. Use `--base <ref>` to compare against another branch.
See [local branch and uncommitted reviews](docs/reference.md#reviewing-before-the-pull-request-exists)
for details.

### Reviewing PRs

Run `pr-review serve` from your clone of the project. It opens **http://localhost:3010**.
Enter the PR or MR number to load the shared canvas, read the grouped diffs, and leave comments.
Keep the terminal running while you review; stop the server with **Ctrl+C**.

## Documentation

- [CLI and configuration reference](docs/reference.md): command options and troubleshooting.
- [Project settings](docs/reference.md#project-config) and [prompt templates](docs/reference.md#prompt-templates): customize generation and review rules.
- [Review controls](docs/reference.md#review-controls): navigation, comments, and sign-off.
- [AI Chat](docs/reference.md#ai-chat): setup and review checkouts.
- [Local preferences](docs/reference.md#local-settings-and-storage): appearance and chat settings.
- [Incremental canvases](docs/reference.md#incremental-canvases): updates and saved review progress.
- [Export and import](docs/reference.md#export-and-import-options): save and share canvases manually.
- [Project website](https://vintasoftware.github.io/pr-review-canvas/): an interactive review walkthrough.

## Contributing

See the [contributor guide](docs/contributing.md) for development setup and checks,
[website guide](docs/website.md) for previews and deployment, and
[publishing guide](docs/publishing.md) for releases.

## License

Licensed under the [Apache License 2.0](LICENSE).
