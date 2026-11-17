/**
 * @typedef {object} SourcePos
 * @property {string} file   Path as shown to the user (relative when possible).
 * @property {number} line   1-based line.
 * @property {number} column 1-based column.
 */

/** An error in a source file, reported as `file:line:column reason`. */
export class BuildError extends Error {
  /**
   * @param {string} reason
   * @param {SourcePos} pos
   */
  constructor(reason, pos) {
    super(`${pos.file}:${pos.line}:${pos.column} ${reason}`);
    this.name = 'BuildError';
    this.reason = reason;
    this.file = pos.file;
    this.line = pos.line;
    this.column = pos.column;
  }
}

/**
 * Converts a string index into a 1-based line and column.
 * @param {string} text
 * @param {number} index
 * @returns {{ line: number, column: number }}
 */
export function positionAt(text, index) {
  let line = 1;
  let lineStart = 0;
  const end = Math.min(Math.max(index, 0), text.length);
  for (let i = 0; i < end; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, column: end - lineStart + 1 };
}
