# The tour is its own artifact, apart from the canvas

A tour (landmarks, decisions, grilling, quiz) and a canvas (layers, folds, attention points) are
generated from the same diff, but we generate the tour with its own skill, store it as its own
file per head commit, and share it as its own pull request comment. The two meet only through
links between their pages. Author and reviewer may use the tour, the canvas, or both.

## Considered options

- **Tour content inside the canvas model.** One generation pass and one shared comment, but the
  canvas prompt grows past what a generator handles well, the canvas comment is already near
  GitHub's size limit, and a reader who wants only the tour would still need a canvas.
- **Tour decisions fed into canvas generation as settled decisions**, as PR 44's deck did. Fewer
  repeated questions on the canvas, but the two artifacts become coupled by carry rules and
  validation errors, which is what would stop the tour from becoming its own project.

## Consequences

- A change can have a tour and no canvas, or a canvas and no tour.
- The diff is prepared twice when both exist. Reading it twice was cheaper than one larger prompt.
- The tour cannot become a separate package without carrying its own prepare and sharing code,
  which is the intent.
