/**
 * SCSS -> CSS with Dart Sass. Compressed output, no source map in dist.
 * Any Sass warning (including deprecations) fails the build, so the source
 * stays ready for the next Sass major version.
 */
import * as sass from 'sass';
import { BuildError } from './errors.js';

/**
 * @param {import('sass').SourceSpan | undefined} span
 * @param {string} fallback
 */
function spanPosition(span, fallback) {
  const file = span?.url ? decodeURIComponent(span.url.pathname).replace(/^\/([A-Za-z]:)/, '$1') : fallback;
  return { file, line: (span?.start.line ?? 0) + 1, column: (span?.start.column ?? 0) + 1 };
}

/**
 * @param {string} entry Absolute path of the main .scss file.
 * @param {{ style?: 'compressed' | 'expanded' }} [options]
 * @returns {{ css: string, loadedFiles: number }}
 */
export function compileStyles(entry, options = {}) {
  /** @type {Array<{ message: string, span: import('sass').SourceSpan | undefined }>} */
  const warnings = [];
  let result;
  try {
    result = sass.compile(entry, {
      style: options.style ?? 'compressed',
      charset: false,
      logger: {
        warn: (message, { span }) => warnings.push({ message: message.split('\n')[0] ?? message, span }),
        debug: () => {},
      },
    });
  } catch (error) {
    if (error instanceof sass.Exception) throw new BuildError(error.sassMessage, spanPosition(error.span, entry));
    throw error;
  }
  const first = warnings[0];
  if (first) {
    const more = warnings.length > 1 ? ` (and ${warnings.length - 1} more)` : '';
    throw new BuildError(`Sass warning: ${first.message}${more}`, spanPosition(first.span, entry));
  }
  return { css: `${result.css}\n`, loadedFiles: result.loadedUrls.length };
}
