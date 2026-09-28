# Tour design

A **tour** is a guided pass over one change. It builds the reader's theory of the change through
beats that explain, decisions the reader keeps or changes, and a quiz. This document records the
design settled on 2026-09-28, before any code. The glossary for it is the "Tour" section of
[CONTEXT.md](../CONTEXT.md). The decision to keep the tour apart from the canvas is
[ADR 0005](adr/0005-tour-is-its-own-artifact.md).

## Why

Two objectives, in this order:

1. Learn what was implemented without reading all the code.
2. Decide the trade-offs, the architecture, the non-functional requirements, and the product
   implications (UI, UX, performance, feel) of the change.

Both with as little cognitive load as possible, and with some fun.

The reading behind it:

- Naur, [Programming as Theory Building](https://pages.cs.wisc.edu/~remzi/Naur.pdf): the product
  of programming is the theory held by the people who built it, not the text. Having the theory
  means you can say how the code maps to the world, why each part is what it is, and how to change
  it. Documentation is auxiliary. A program dies when the team holding its theory dissolves.
- Storey and Willison, [cognitive debt](https://simonwillison.net/2026/Feb/15/cognitive-debt/):
  the debt lives in developers' heads. Features prompted into existence without review made every
  later feature harder to reason about.
- Litt, [Understanding is the new bottleneck](https://www.geoffreylitt.com/2026/07/02/understanding-is-the-new-bottleneck):
  explanations as literate prose arranged by idea with figures, quizzes as speed regulators,
  micro-worlds where agents write code to help us understand code, shared spaces for team models.
- Litt, [AI HUDs](https://www.geoffreylitt.com/2025/07/27/enough-ai-copilots-we-need-ai-huds) and
  [the generated debugger](https://www.geoffreylitt.com/2024/12/22/making-programming-more-fun-with-an-ai-generated-debugger):
  show rather than converse; a bespoke tool built for the moment turns a slog into puzzles.
- Litt, [Code like a surgeon](https://www.geoffreylitt.com/2025/10/24/code-like-a-surgeon): agents
  prepare the operating room; the human keeps the primary work with fast feedback loops.
- Kun Chen: agents cannot judge "how does it feel". Only a human who experiences the thing can.
- staysaasy: people do not want more decisions. Every decision a tool asks is a cost.
- Berkopec: pokayoke. Structures that make a class of mistake impossible are what to validate in
  generated code.
- [cekrem on Naur](https://cekrem.github.io/posts/programming-as-theory-building-naur/): generated
  code is "nobody's theory"; review for theoretical consistency.
- The Pragmatic Engineer, September 2026: coding by hand is over at 37signals; "nobody is reading
  anything"; sloppy features ship because nobody felt them.

## The flow

1. **Setup** (optional, once per project): `/pr-tour-setup` interviews the user and writes the
   guide. `/pr-tour` runs the same interview when no guide exists, and the user may skip it.
2. **Generate**: `/pr-tour <n|branch|uncommitted>` prepares the diff, reads the guide and any specs
   it names, writes the tour, validates it, previews every beat as a screenshot and fixes what
   reads badly, verifies the try-it recipe, and shares the tour on the pull request.
3. **Take**: the reader opens `/tour/<key>`, reads the beats, plays the micro-world, picks keep or
   change on each decision, is grilled on each change, answers the quiz.
4. **Finish**: the agent restates the whole plan once; the reader confirms; the tour writes the
   re-implementation prompt and shares the record.
5. **Apply**: `/pr-tour-apply` implements the plan, runs the project checks, and offers a fresh
   tour. A new head regenerates the tour and carries picks by decision key.

The author and every reviewer take the same tour. A reviewer's change requests become comments in
their pending review, posted with their verdict, plus the same prompt for the author.

## Beats

Beats come in Naur's order:

1. What the change means to the world: the user's or the spec's view of it.
2. Why each part is the way it is. Decisions anchor here.
3. What a later change must respect: extension points, invariants, pokayoke.

Each beat has a scene, a picture drawn for this change. One beat may be a micro-world: an
interactive model of the changed behavior, when the change has behavior worth playing with. The
diff chunk behind a beat is one key away and never required.

The budget is proportional to the diff with a configurable ceiling. What the budget leaves out is
listed at the end, one line each with a link to the code, as **not toured**.

## Decisions

A decision is a choice the change makes that a reasonable engineer could make another way. The
reader **keeps** it or asks to **change** it. The generator's recommendation is preselected, so a
keep is one tap.

Categories:

- Trade-offs: rare cases, compatibility, generality, failure policy, performance against plainness.
- Architecture and shape: where logic lives, reuse against build, new pattern against convention,
  public names.
- Product and feel: UI, UX, copy, animation, perceived performance, accessibility.
- Pokayoke: what the change makes impossible to get wrong, and where it lacks such a structure.
- The project's non-functional requirements, as the guide names them.
- Spec fidelity: where the change departs from the spec or the design it was built from.

A kept decision records a **reason** and where it belongs: a code comment (a maintainer needs it),
a comment on the pull request line (a reviewer would ask), or the tour only. The generator
proposes the place; the author confirms. Code comments become part of the plan. Pull request
comments post once, when the tour is finished.

For product decisions the beat also carries a **try-it** recipe: how to run the change, which
synthetic data to use, and what to look at. The reader marks that they tried it.

## Grilling

A change pick opens the chat with a tour seed. The agent asks its questions in prose. When it can
restate the change, it emits a fenced restatement block: what changes, where, what stays the same.
The page turns the block into a card with approve, edit, and reject. Only an approved restatement
enters the plan. The reader may also run a **reverse quiz**: ask the agent how it would carry the
plan out, to catch a wrong understanding before it runs.

At the end the agent restates the whole plan as one block. The reader confirms it, and the tour
writes the prompt. The plan needs no further review.

The reader may speak instead of type. Speech goes through the browser's Web Speech API. The page
says once where the browser sends audio; a project can turn audio off.

## Quiz

A few plain questions after the decisions that check the reader read the beats: what an end user
or a caller would notice, and which decisions the change made and why. Not gotchas, not edge cases
the beats did not cover, not details only the code shows, and not UI values nobody needs to
remember. A wrong answer reopens the beat. The result stays with the reader and never reaches the shared tour or the pull request. A
project can turn the quiz off or require it before the prompt is written.

## Look

Each tour gets a **mood** from a validated catalog: an accent and a display font from a bundled
set. The mood themes the beats, scenes, and quiz. Controls, chat, and the diff keep the
app's skin and theme. Scenes and micro-worlds run in the sandboxed frame from PR 44 (no origin,
inline code only, no network). No badges, streaks, or scores.

## The guide

A committed markdown file, `docs/pr-tour.md` by default (`tour.guide` in the config points
elsewhere). It holds:

- how to run the app;
- how to make synthetic test data, and where fixtures may be written (fixture, seed, and test
  directories only);
- which non-functional requirements matter here;
- where specs and designs live (plan files, a task tool, Figma);
- what the agent may run.

The guide is an allowlist. An action it does not name is asked first and then recorded, so it is
asked once. It never holds credentials and never names a production target. The skills edit it as
the user steers them.

The generation skill runs the recipe, seeds fixtures, and records the exact steps. The review
server executes nothing: the reader runs the recipe in their terminal or hands it to their agent.

## Sharing and storage

A tour is stored beside the canvases, per head commit. On a pull request it is shared as its own
hidden comment holding the ZIP as base64. When the comment does not fit the host's limit, the skill
exports the ZIP and asks the author to attach it to the pull request; discovery finds attachment
links. Local reviews (`branch`, `uncommitted`) never share. The record is shared at generation and
again once at finish.

## Configuration

Under `tour:` in `pr-review.config.yml`:

| Key           | Values                                                                    | Default                                                  |
| ------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| `budget`      | ceilings for beats, decisions, quiz questions, and changed lines per beat | about one beat per 150 changed lines; ceilings 8 / 5 / 5 |
| `finalQuiz`   | `on`, `off`, `required`                                                   | `on`                                                     |
| `reverseQuiz` | `on`, `off`                                                               | `on`                                                     |
| `grill`       | `change`, `always`, `off`                                                 | `change`                                                 |
| `audio`       | `on`, `off`                                                               | `on`, with the notice                                    |
| `microWorld`  | `on`, `off`                                                               | `on`                                                     |
| `tryIt`       | `on`, `off`                                                               | `on` when the guide has a run recipe                     |
| `categories`  | list                                                                      | all six                                                  |
| `share`       | `on`, `off`                                                               | same as canvas sharing                                   |
| `models`      | per agent id                                                              | `generation.models`                                      |
| `guide`       | path                                                                      | `docs/pr-tour.md`                                        |

The chat agent and model follow the existing chat settings.

## Boundaries

- Skills: `pr-tour`, `pr-tour-setup`, `pr-tour-apply`. Skill install and upgrade handle several
  skills.
- The page is `/tour/<n|branch|uncommitted>`, with its own module, keyboard and mobile parity,
  and links from the home page and the canvas header.
- A tour needs no canvas: its own prepare builds the diff, its own chat subject and seed template
  serve the grilling, one chat thread per tour, and the chat agent stays read-only.
- Model choice follows `generation.models`. GitHub and GitLab both work.
- The README and the site present the tour as the recommended pass before review. The canvas's
  own self-review (resolving author points) stays and is optional. Author and reviewer may use the
  tour, the canvas, or both.
- Not in the first version: incremental tours, structured turns in acpx, local transcription,
  screenshots of the running app taken by the skill.

## PR 44

PR 44 (the self-review deck) is closed. Its scene sandbox (ADR 0005 there), scene runtime, scene
guide, and preview loop are ported onto this branch. Its A/B cards, fix list, and settled
decisions fed into the canvas are not.

## Next step

Before building, iterate on a prototype tour with the maintainer: the look, the order of things,
and the interactions, without integrated functionality.
