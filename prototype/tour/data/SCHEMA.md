# Tour data for the prototype

One ES module per tour, `data/pr-<n>.js`, with `export default { ... }`. The page reads it and
scripts the whole flow from it. Real functions are allowed (scenes and micro-worlds get an `init`).
No secrets, no PHI. Every string a reader sees is plain text unless the field says HTML.

```js
export default {
  key: 67,
  title: 'Print human-readable output for …',           // the PR title
  repo: 'vintasoftware/pr-review-canvas',
  head: '7f7f84e',                                        // short sha
  author: 'fjsj',
  changed: { files: 12, added: 314, removed: 63 },
  mood: 'terminal',                                       // one of: terminal, blueprint, paper, grid
  spec: null,                                             // or { kind: 'pr-description' | 'plan' | 'issue', title, url? }

  beats: [
    {
      id: 'b1',
      stage: 'world',                 // 'world' | 'why' | 'respect' (Naur order; one 'world' first, one 'respect' last)
      title: 'One rule for who reads the output',       // ≤ 60 chars
      lead: 'A person at a terminal gets text; a program on a pipe gets JSON.', // one sentence, ≤ 140 chars
      body: [                          // 1 to 3 short paragraphs, plain text, ≤ 70 words each. Inline `code` allowed.
        '…',
      ],
      scene: {                         // a picture of this beat, drawn for this change
        html: '<div class="sc-…">…</div>',   // HTML string; SVG welcome; classes prefixed sc-; fluid (max-width 100%)
        css: '.sc-… { … }',                   // optional; scoped to your sc- classes; use the page tokens:
                                              // var(--fg) var(--fg-muted) var(--bg) var(--panel) var(--line)
                                              // var(--accent) var(--ok) var(--bad) var(--warn) var(--mono) var(--sans)
        init: root => {},                     // optional; runs once with the scene's root element
      },
      micro: null,                      // or { html, css, init(root) }: an interactive model of the changed
                                        // behavior, inputs in, outcomes out. At most ONE beat has a micro.
      code: [                           // the chunks behind this beat, shown on demand; 0 to 3
        { path: 'src/cli-text.ts', lang: 'ts', diff: '@@ -1,4 +1,6 @@\n …unified diff text…' },
      ],
      decisions: ['d1'],                // ids of decisions anchored here; only on 'why' beats (and maybe 'respect')
    },
  ],

  decisions: [
    {
      id: 'd1',
      key: 'json-on-pipe',              // stable slug
      category: 'trade-off',            // 'trade-off' | 'architecture' | 'product' | 'pokayoke' | 'nfr' | 'spec'
      beat: 'b2',
      title: 'Does a pipe imply JSON?',  // ≤ 70 chars, a question or noun phrase
      context: '…',                     // 1 to 2 sentences: what the code does and why the choice matters now
      keep: { label: 'Pipe means JSON', consequence: '…' },      // what the code does now; consequence ≤ 2 sentences, cost included
      change: { label: 'Only --json means JSON', consequence: '…' }, // the alternative, same rules
      recommended: 'keep',              // 'keep' | 'change' — the generator's recommendation, preselected
      reason: { text: '…', place: 'pr' },   // the reason recorded on keep, in the author's voice (≤ 200 chars);
                                            // place: 'code' (a maintainer needs it) | 'pr' (a reviewer would ask) | 'tour'
      anchor: { path: 'src/cli-text.ts', line: 42 },
      tryIt: null,                      // product decisions only: { steps: ['pnpm build', 'node bin/pr-review.js clean --dry-run | cat'],
                                        //   look: ['what to look at', '…'] } — steps must be real commands of this repo
      grill: {                          // scripted grilling for when the reader picks 'change'
        questions: ['…', '…'],          // 2 to 3 questions the agent asks, one at a time, ≤ 160 chars each
        answers: ['…', '…'],            // a plausible reader answer per question (the prototype types it for the reader)
        restatement: {                  // the agent's restatement card after the questions
          what: '…',                    // what changes, 1 to 2 sentences
          where: ['src/cli-text.ts', 'docs/reference.md'],
          unchanged: '…',               // what stays the same, 1 sentence
        },
        reverse: { question: 'How would you implement it?', answer: '…' }, // the reverse quiz, one exchange; answer ≤ 90 words
      },
    },
  ],

  quiz: [
    {
      id: 'q1',
      beat: 'b2',                       // the beat a wrong answer reopens
      question: 'What prints when `pr-review clean` runs inside a cron job?',   // puzzle-shaped: what prints / what breaks if
      options: ['…', '…', '…'],         // 3 options
      answer: 1,                        // index of the right one
      why: '…',                         // one sentence shown after answering
    },
  ],

  notToured: [                          // what the budget left out; 0 to 6
    { title: 'CHANGELOG entry', path: 'CHANGELOG.md' },
  ],
}
```

Rules for the content:

- Everything comes from the real diff and the PR description. No invented behavior.
- Beats in Naur order: the first beat is the change as a user or the spec sees it; the middle
  beats each explain one part and why it is shaped that way (decisions anchor there); the last
  beat is what a later change must respect: invariants, extension points, pokayoke.
- Reading all beats takes under 8 minutes. Prefer fewer, sharper beats.
- Decisions are choices a reasonable engineer could make another way. Both sides have a real
  cost. Most recommendations are `keep`; a `change` recommendation must be argued in `context`.
  Cover at least three categories; include a `pokayoke` decision when the change has one.
- Scenes show what happens, to whom, and at what cost, with this change's real names and values.
  Vary the kind of picture across beats (a terminal, a flow, a table, a before/after, a timeline).
- The micro-world lets the reader change inputs and see the outcome; keep it to a few controls.
- Scenes and micro-worlds must read at 360px wide and in dark theme (use the tokens; never
  hard-code white or black).
- Quiz questions are puzzles about consequences, not recall of names.
