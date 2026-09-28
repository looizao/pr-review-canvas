import type { FileEntry, TestEntry } from '../contract/review-artifact.js'
import { hunkForLine, splitHunks } from '../git/patch-lines.js'
import { coveredStem, sourceStem } from './test-paths.js'

type Test = Pick<TestEntry, 'status' | 'testPath' | 'anchor'>
export type MissingTestLayer = { files: ReadonlyArray<{ path: string; hunks: readonly string[] }> }

/** A supplied anchor, or the first changed row in the subject file's assigned chunks. */
export function missingTestAnchor(
  test: Test,
  layer: MissingTestLayer,
  files: readonly FileEntry[],
  patches: Readonly<Record<string, string>>
): NonNullable<TestEntry['anchor']> | null {
  if (test.anchor !== undefined) {
    const entry = files.find(f => f.path === test.anchor?.path)
    const hunk = entry === undefined ? null : hunkForLine(entry.hunks, test.anchor.side, test.anchor.line)
    return hunk !== null && layer.files.some(f => f.path === test.anchor?.path && f.hunks.includes(hunk.id))
      ? test.anchor
      : null
  }
  const subject = test.testPath === undefined ? undefined : coveredStem(test.testPath)
  const ordered = [...layer.files].sort(
    (a, b) => Number(sourceStem(b.path) === subject) - Number(sourceStem(a.path) === subject)
  )
  for (const file of ordered) {
    const entry = files.find(f => f.path === file.path)
    const hunks = splitHunks(patches[entry?.key ?? ''] ?? '')
    for (const [i, hunk] of hunks.entries()) {
      if (!file.hunks.includes(entry?.hunks[i]?.id ?? '')) continue
      let old = hunk.oldStart
      let current = hunk.newStart
      for (const row of hunk.lines) {
        if (row.startsWith('+')) return { path: file.path, line: current, side: 'new' }
        if (row.startsWith('-')) return { path: file.path, line: old, side: 'old' }
        if (row.startsWith(' ')) {
          old++
          current++
        }
      }
    }
  }
  return null
}

/** Generated points and fold repairs use the same anchor. */
export function missingTestPins(
  layer: MissingTestLayer & { tests: ReadonlyArray<Test & Pick<TestEntry, 'behavior'>> },
  files: readonly FileEntry[],
  patches: Readonly<Record<string, string>>
) {
  return layer.tests.flatMap(test => {
    if (test.status !== 'missing') return []
    const anchor = missingTestAnchor(test, layer, files, patches)
    return anchor === null ? [] : [{ ...anchor, generatedFrom: test.behavior }]
  })
}
