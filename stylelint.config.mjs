// Stylelint for the app's and the site's CSS. It catches invalid and unknown CSS; the formatter
// owns whitespace, and scripts/check-css-usage.mjs catches CSS the markup no longer uses.
/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  reportDescriptionlessDisables: true,
  // Every custom property the app reads must be set in one of its own stylesheets.
  referenceFiles: ['static/styles/*.css'],
  rules: {
    // oxfmt owns blank lines.
    'at-rule-empty-line-before': null,
    'comment-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'declaration-empty-line-before': null,
    'rule-empty-line-before': null,
    // The component files and the GitHub skin override by specificity on purpose, and this rule
    // compares selectors by their last part without knowing whether they can match the same element.
    'no-descending-specificity': null,

    'declaration-property-value-no-unknown': true,
    'no-unknown-animations': true,
    'no-unknown-custom-media': true,
    'no-unknown-custom-properties': true,
    // Safari has no unprefixed text-size-adjust.
    'property-no-vendor-prefix': [true, { ignoreProperties: ['-webkit-text-size-adjust'] }],
    // Font names keep their own case.
    'value-keyword-case': ['lower', { ignoreProperties: ['font-family', '/^--(sans|mono)$/'] }],
    'selector-class-pattern': [
      '^(hljs-[a-z_]+|[a-z]+_|[a-z][a-z0-9]*(-[a-z0-9]+)*)$',
      { message: 'Expected a kebab-case class name (highlight.js scope classes are the exception)' },
    ],
  },
}
