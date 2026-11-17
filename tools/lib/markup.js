/**
 * A small, tolerant HTML/SVG tag scanner. It is not a full HTML parser: it
 * finds tags, their attributes (with source offsets) and raw-text elements,
 * skips comments, and never throws on malformed input. That is enough for
 * the dist checker and the build-time component expander.
 */

/** @typedef {{ name: string, value: string | null, index: number }} Attr */
/**
 * @typedef {object} TagToken
 * @property {'open' | 'close'} kind
 * @property {string} name     Lower-cased tag name.
 * @property {number} index    Offset of the `<`.
 * @property {number} end      Offset just after the `>` (or end of input).
 * @property {Attr[]} attrs
 * @property {boolean} selfClosing
 * @property {boolean} terminated  False when the input ended before `>`.
 */
/** @typedef {{ kind: 'raw', name: string, index: number, text: string }} RawToken */

const RAW_TEXT = new Set(['style', 'script', 'textarea', 'title']);

/** @param {number} code */
const isSpace = (code) => code === 32 || code === 9 || code === 10 || code === 12 || code === 13;
/** @param {number} code */
const isAsciiLetter = (code) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);

/**
 * Reads attributes starting at `pos` (just after the tag name) up to `>`.
 * @param {string} text
 * @param {number} pos
 * @returns {{ attrs: Attr[], end: number, selfClosing: boolean, terminated: boolean }}
 */
export function readAttributes(text, pos) {
  /** @type {Attr[]} */
  const attrs = [];
  let i = pos;
  let selfClosing = false;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (isSpace(code)) {
      i += 1;
      continue;
    }
    if (code === 62 /* > */) {
      return { attrs, end: i + 1, selfClosing, terminated: true };
    }
    if (code === 47 /* / */) {
      selfClosing = text.charCodeAt(i + 1) === 62;
      i += 1;
      continue;
    }
    selfClosing = false;
    const nameStart = i;
    i += 1; // the first character is always part of the name (even "=")
    while (i < text.length) {
      const c = text.charCodeAt(i);
      if (isSpace(c) || c === 47 || c === 62 || c === 61 /* = */) break;
      i += 1;
    }
    const name = text.slice(nameStart, i).toLowerCase();
    let j = i;
    while (j < text.length && isSpace(text.charCodeAt(j))) j += 1;
    /** @type {string | null} */
    let value = null;
    if (text.charCodeAt(j) === 61) {
      j += 1;
      while (j < text.length && isSpace(text.charCodeAt(j))) j += 1;
      const quote = text[j];
      if (quote === '"' || quote === "'") {
        const close = text.indexOf(quote, j + 1);
        const stop = close === -1 ? text.length : close;
        value = text.slice(j + 1, stop);
        j = close === -1 ? text.length : close + 1;
      } else {
        const valueStart = j;
        while (j < text.length && !isSpace(text.charCodeAt(j)) && text.charCodeAt(j) !== 62) j += 1;
        value = text.slice(valueStart, j);
      }
      i = j;
    }
    attrs.push({ name, value, index: nameStart });
  }
  return { attrs, end: text.length, selfClosing, terminated: false };
}

/**
 * Yields tags and raw-text element contents in document order.
 * @param {string} text
 * @returns {Generator<TagToken | RawToken>}
 */
export function* scanTags(text) {
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt === -1) return;
    if (text.startsWith('<!--', lt)) {
      const close = text.indexOf('-->', lt + 4);
      i = close === -1 ? text.length : close + 3;
      continue;
    }
    const next = text.charCodeAt(lt + 1);
    if (next === 33 /* ! */ || next === 63 /* ? */) {
      const close = text.indexOf('>', lt + 2);
      i = close === -1 ? text.length : close + 1;
      continue;
    }
    const closing = next === 47; /* / */
    const nameStart = lt + (closing ? 2 : 1);
    if (!isAsciiLetter(text.charCodeAt(nameStart))) {
      i = lt + 1;
      continue;
    }
    let k = nameStart;
    while (k < text.length) {
      const c = text.charCodeAt(k);
      if (isSpace(c) || c === 47 || c === 62) break;
      k += 1;
    }
    const name = text.slice(nameStart, k).toLowerCase();
    const { attrs, end, selfClosing, terminated } = readAttributes(text, k);
    yield { kind: closing ? 'close' : 'open', name, index: lt, end, attrs, selfClosing, terminated };
    i = end;
    if (!closing && !selfClosing && RAW_TEXT.has(name)) {
      const closeTag = new RegExp(`</${name}[\\s/>]`, 'i');
      const rest = text.slice(end);
      const m = closeTag.exec(rest);
      const stop = m ? end + m.index : text.length;
      yield { kind: 'raw', name, index: end, text: text.slice(end, stop) };
      i = stop;
    }
  }
}

/** @type {Record<string, string>} */
const NAMED = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  colon: ':',
  tab: '\t',
  newline: '\n',
  sol: '/',
  lpar: '(',
  rpar: ')',
};

/**
 * Decodes numeric character references and the named references that can
 * matter for URL schemes. Unknown names are left as they are.
 * @param {string} value
 */
export function decodeEntities(value) {
  return value.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);?/g, (whole, ref) => {
    if (ref[0] === '#') {
      const hex = ref[1] === 'x' || ref[1] === 'X';
      const code = Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '�';
    }
    const named = NAMED[ref.toLowerCase()];
    return named ?? whole;
  });
}
