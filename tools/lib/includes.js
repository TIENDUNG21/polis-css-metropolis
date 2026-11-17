/**
 * `<!-- @include path -->` resolution for the HTML source. Paths are relative
 * to the including file. Each file is transformed (component expansion) before
 * its includes are inlined, so errors keep the original file's line numbers.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { BuildError, positionAt } from './errors.js';

/**
 * @typedef {object} IncludeOptions
 * @property {string} root  Directory used to print short file names.
 * @property {(path: string) => string} [read]
 * @property {(text: string, file: string) => string} [transform]
 */

const INCLUDE = /<!--\s*@include(?:\s+(\S+?))?\s*-->/g;

/** @param {string} path */
const defaultRead = (path) => readFileSync(path, 'utf8');

/**
 * @param {string} root
 * @param {string} path
 */
export function displayName(root, path) {
  return relative(root, path).split(sep).join('/');
}

/**
 * @param {string} file Absolute path of the entry file.
 * @param {IncludeOptions} options
 * @returns {string}
 */
export function resolveIncludes(file, options) {
  return resolveFile(file, options, []);
}

/**
 * @param {string} file
 * @param {IncludeOptions} options
 * @param {string[]} stack
 * @returns {string}
 */
function resolveFile(file, options, stack) {
  const read = options.read ?? defaultRead;
  const name = displayName(options.root, file);
  const raw = read(file);
  const text = options.transform ? options.transform(raw, name) : raw;
  const chain = [...stack, file];

  return text.replace(INCLUDE, (_match, target, /** @type {number} */ index) => {
    const pos = { file: name, ...positionAt(text, index) };
    if (typeof target !== 'string' || target.length === 0) {
      throw new BuildError('@include needs a file path', pos);
    }
    const path = join(dirname(file), target);
    if (chain.includes(path)) {
      const names = [...chain, path].map((p) => displayName(options.root, p));
      throw new BuildError(`include cycle: ${names.join(' -> ')}`, pos);
    }
    let included;
    try {
      included = resolveFile(path, options, chain);
    } catch (error) {
      if (error instanceof BuildError) throw error;
      const code = /** @type {{ code?: string }} */ (error).code;
      const reason = code === 'ENOENT' ? 'file not found' : String(error);
      throw new BuildError(`cannot include "${target}": ${reason}`, pos);
    }
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    const before = text.slice(lineStart, index);
    const indent = /^[ \t]*$/.test(before) ? before : '';
    const lines = included.replace(/\n$/, '').split('\n');
    return lines.map((line, i) => (i === 0 || line === '' ? line : indent + line)).join('\n');
  });
}
