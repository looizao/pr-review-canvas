// The site's stylesheets read the site's own tokens, from site/styles.css.
/** @type {import('stylelint').Config} */
export default {
  extends: ['../stylelint.config.mjs'],
  referenceFiles: ['*.css'],
}
