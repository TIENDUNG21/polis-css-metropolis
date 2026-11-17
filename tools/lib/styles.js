/**
 * SCSS -> CSS with Dart Sass. Compressed output, no source map in dist.
 */
import * as sass from 'sass';
import { BuildError } from './errors.js';

/**
 * @param {string} entry Absolute path of the main .scss file.
 * @param {{ style?: 'compressed' | 'expanded' }} [options]
 * @returns {{ css: string, loadedFiles: number }}
 */
export function compileStyles(entry, options = {}) {
  try {
    const result = sass.compile(entry, { style: options.style ?? 'compressed', charset: false });
    return { css: `${result.css}\n`, loadedFiles: result.loadedUrls.length };
  } catch (error) {
    if (error instanceof sass.Exception) {
      const span = error.span;
      const file = span.url ? decodeURIComponent(span.url.pathname).replace(/^\/([A-Za-z]:)/, '$1') : entry;
      throw new BuildError(error.sassMessage, { file, line: span.start.line + 1, column: span.start.column + 1 });
    }
    throw error;
  }
}
