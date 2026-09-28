import { TEXT_CAPS, type ModelOutput } from '../contract/review-artifact.js'
import { toFileEntry, toPatchMap } from '../git/diff-collector.js'
import { SYNTHETIC_FILES, syntheticArtifact } from '../testing/synthetic.js'
import { missingTestAnchor, missingTestPins } from './missing-tests.js'
import { artifactToModelOutput, normalize } from './normalize.js'
import { applyFoldFixes, describeFoldFix } from './fix-folds.js'
import { validateModelOutput } from './validate.js'
import { LIMITS } from '../contract/review-artifact.js'

const files = SYNTHETIC_FILES.map(toFileEntry)
const patches = toPatchMap(SYNTHETIC_FILES)
function model(): ModelOutput {
  const output = artifactToModelOutput(syntheticArtifact())
  output.layers[0]!.tests = [{ status: 'missing', behavior: 'Important behavior without a test' }]
  return output
}

it('defaults to reviewer and changed code, and honors explicit routing and anchors', () => {
  const output = model()
  const input = {
    files,
    patches,
    caps: TEXT_CAPS,
    highRisk: [],
    pr: syntheticArtifact().pr,
    generatedAt: '2026-09-27T12:00:00Z',
    generator: syntheticArtifact().generator,
  }
  const point = normalize(output, input).points.find(p => p.origin === 'tests')!
  expect(point).toMatchObject({ audience: 'reviewer', path: 'src/app.ts', line: 2, side: 'new' })
  output.layers[0]!.tests[0]!.audience = 'author'
  output.layers[0]!.tests[0]!.anchor = { path: 'src/app.ts', line: 4, side: 'new' }
  expect(normalize(output, input).points.find(p => p.origin === 'tests')).toMatchObject({
    audience: 'author',
    line: 4,
    side: 'new',
  })
})

it('uses the subject matched by testPath before the first file and falls back for an unknown subject', () => {
  const layer = {
    files: [
      { path: 'src/new.ts', hunks: ['src_new_ts#1'] },
      { path: 'src/app.ts', hunks: ['src_app_ts#2'] },
    ],
  }
  expect(
    missingTestAnchor({ status: 'missing', testPath: 'src/app.test.ts' }, layer, files, patches)
  ).toEqual({ path: 'src/app.ts', line: 12, side: 'new' })
  expect(
    missingTestAnchor({ status: 'missing', testPath: 'unknown.test.ts' }, layer, files, patches)?.path
  ).toBe('src/new.ts')
  expect(missingTestAnchor({ status: 'missing' }, layer, [], {})).toBeNull()
  expect(missingTestAnchor({ status: 'missing' }, { files: [] }, files, patches)).toBeNull()
})

it('refuses explicit anchors outside the layer and reports the generated behavior', () => {
  const output = model()
  const test = output.layers[0]!.tests[0]!
  for (const anchor of [
    { path: 'unknown.ts', line: 1, side: 'new' as const },
    { path: 'src/app.ts', line: 900, side: 'new' as const },
    { path: 'src/gone.ts', line: 1, side: 'old' as const },
  ]) {
    test.anchor = anchor
    const result = validateModelOutput(output, {
      files,
      patches,
      caps: TEXT_CAPS,
      highRisk: [],
      limits: LIMITS,
    })
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'POINT_OUTSIDE_DIFF', message: expect.stringContaining(test.behavior) })
    )
  }
  expect(missingTestPins(output.layers[0]!, files, patches)).toEqual([])
})

it('names a generated point when dropping a repaired fold under three lines', () => {
  const output = model()
  output.points = []
  output.layers[0]!.tests[0]!.anchor = { path: 'src/app.ts', line: 3, side: 'new' }
  output.layers[0]!.files[0]!.folds = [
    { title: 'helper', side: 'new', startLine: 3, endLine: 5, level: 'moderate' },
  ]
  expect(applyFoldFixes(output, files, patches).map(describeFoldFix)).toEqual([
    'dropped fold "helper" at new 3-5: shrunk to keep the point generated from the missing test \'Important behavior without a test\' at new 3 visible; fewer than three lines remain',
  ])
  expect(output.layers[0]!.files[0]!.folds).toEqual([])
})

it('shortens generated titles at a word boundary', () => {
  const output = model()
  output.layers[0]!.tests[0]!.behavior = 'A missing behavior '.repeat(7)
  const point = normalize(output, {
    files,
    patches,
    caps: TEXT_CAPS,
    highRisk: [],
    pr: syntheticArtifact().pr,
    generatedAt: '2026-09-27T12:00:00Z',
    generator: syntheticArtifact().generator,
  }).points.find(p => p.origin === 'tests')!
  expect(point.title.length).toBeLessThanOrEqual(TEXT_CAPS.pointTitle)
  expect(point.title).toMatch(/(?:A|missing|behavior)…$/)
})

it.each([1, 7, 90])('keeps an unbroken generated title within the cap of %i', pointTitle => {
  const output = model()
  output.layers[0]!.tests[0]!.behavior = 'UnbrokenBehaviorName'.repeat(6)
  const point = normalize(output, {
    files,
    patches,
    caps: { ...TEXT_CAPS, pointTitle },
    highRisk: [],
    pr: syntheticArtifact().pr,
    generatedAt: '2026-09-27T12:00:00Z',
    generator: syntheticArtifact().generator,
  }).points.find(p => p.origin === 'tests')!
  expect(point.title).toBe(pointTitle === 1 ? '…' : pointTitle === 7 ? 'Test…' : 'Missing test…')
})

it('skips context-only chunks and no-newline markers before choosing a changed row', () => {
  const layer = { files: [{ path: 'src/app.ts', hunks: ['src_app_ts#1', 'src_app_ts#2'] }] }
  const patch = '@@ -1,1 +1,1 @@\n context\n\\ No newline at end of file\n@@ -11,1 +11,1 @@\n-removed\n+added'
  expect(missingTestAnchor({ status: 'missing' }, layer, files, { src_app_ts: patch })).toEqual({
    path: 'src/app.ts',
    line: 11,
    side: 'old',
  })
  expect(
    missingTestAnchor({ status: 'missing' }, layer, [{ ...files[0]!, hunks: [] }], { src_app_ts: patch })
  ).toBeNull()
})

it('applies the point-title cap to fold titles too', () => {
  const output = model()
  output.layers[0]!.files[0]!.folds = [
    { title: 'x'.repeat(TEXT_CAPS.pointTitle + 1), side: 'new', startLine: 3, endLine: 5, level: 'moderate' },
  ]
  expect(
    validateModelOutput(output, { files, patches, caps: TEXT_CAPS, highRisk: [], limits: LIMITS }).errors
  ).toContainEqual(
    expect.objectContaining({ code: 'TEXT_TOO_LONG', where: 'layers.0.files.0.folds.0.title' })
  )
})
