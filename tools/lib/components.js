/**
 * Build-time components. The HTML source describes the city with a handful
 * of custom tags (<polis-block>, <polis-building>, <polis-tree>, <polis-lamp>,
 * <polis-car>); this module validates them and expands them into plain HTML
 * whose geometry lives in inline custom properties (tile units), which the
 * SCSS turns into 3D transforms. Nothing here runs in the browser.
 */
import { BuildError, positionAt } from './errors.js';
import { scanTags } from './markup.js';

/** World size in tiles; must match $world-cols / $world-rows in scss/core/_tokens.scss. */
export const WORLD = Object.freeze({ cols: 60, rows: 44 });

export const BLOCK_KINDS = ['downtown', 'civic', 'oldtown', 'park', 'harbor', 'riverside', 'plaza'];
export const BUILDING_KINDS = ['glass', 'office', 'brick', 'house', 'apartment', 'warehouse', 'landmark'];
export const ROOFS = ['flat', 'gable', 'spire', 'antenna', 'garden', 'helipad'];
export const TREE_KINDS = ['round', 'pine', 'autumn'];
/** Traffic routes; each needs an offset-path in scss/systems/traffic/_routes.scss. */
export const ROUTES = ['a-east', 'a-west', 'b-north', 'b-south'];

/**
 * @typedef {string | number} Value
 * @typedef {{ parse: (raw: string) => Value | undefined, describe: string }} AttrType
 * @typedef {{ type: AttrType, default?: Value }} AttrSpec
 * @typedef {{ name: string, attrs: Record<string, Value>, line: number, index: number }} Instance
 * @typedef {object} Component
 * @property {Record<string, AttrSpec>} attrs
 * @property {'block' | 'world'} parent  Where the component may appear.
 * @property {boolean} container         Whether it may contain markup.
 * @property {(attrs: Record<string, Value>, inner: string) => string} render
 */

/**
 * @param {number} min
 * @param {number} max
 * @returns {AttrType}
 */
const int = (min, max) => ({
  describe: `an integer from ${min} to ${max}`,
  parse: (raw) => {
    if (!/^-?\d+$/.test(raw)) return undefined;
    const n = Number(raw);
    return n >= min && n <= max ? n : undefined;
  },
});

/**
 * @param {number} min
 * @param {number} max
 * @returns {AttrType}
 */
const num = (min, max) => ({
  describe: `a number from ${min} to ${max}`,
  parse: (raw) => {
    if (!/^-?\d+(\.\d{1,3})?$/.test(raw)) return undefined;
    const n = Number(raw);
    return n >= min && n <= max ? n : undefined;
  },
});

/**
 * @param {string[]} values
 * @returns {AttrType}
 */
const oneOf = (values) => ({
  describe: `one of ${values.join(', ')}`,
  parse: (raw) => (values.includes(raw) ? raw : undefined),
});

/** @type {AttrType} */
const hexColour = {
  describe: 'a hex colour like #e0b050',
  parse: (raw) => (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw.toLowerCase() : undefined),
};

/**
 * Inline style with geometry custom properties only.
 * @param {Array<[string, Value]>} pairs
 */
const style = (pairs) => pairs.map(([k, v]) => `--${k}:${v}`).join(';');

/** @param {string} cls */
const span = (cls) => `<span class="${cls}"></span>`;

/** @param {string} roof */
function roofMarkup(roof) {
  const roofClass = roof === 'flat' ? 'bldg__roof' : `bldg__roof bldg__roof--${roof}`;
  let extras = '';
  if (roof === 'gable') {
    extras = ['bldg__slope bldg__slope--n', 'bldg__slope bldg__slope--s', 'bldg__gable bldg__gable--e', 'bldg__gable bldg__gable--w']
      .map(span)
      .join('');
  } else if (roof === 'spire' || roof === 'antenna') {
    extras = span(`bldg__${roof}`);
  }
  return span(roofClass) + extras;
}

/** @type {Record<string, Component>} */
export const COMPONENTS = {
  'polis-block': {
    parent: 'world',
    container: true,
    attrs: {
      x: { type: int(0, WORLD.cols - 1) },
      y: { type: int(0, WORLD.rows - 1) },
      w: { type: int(1, WORLD.cols) },
      d: { type: int(1, WORLD.rows) },
      kind: { type: oneOf(BLOCK_KINDS) },
    },
    render: (a, inner) =>
      `<div class="block block--${a.kind}" style="${style([
        ['x', a.x ?? 0],
        ['y', a.y ?? 0],
        ['w', a.w ?? 1],
        ['d', a.d ?? 1],
      ])}">${inner}</div>`,
  },
  'polis-building': {
    parent: 'block',
    container: false,
    attrs: {
      x: { type: int(0, WORLD.cols - 1) },
      y: { type: int(0, WORLD.rows - 1) },
      w: { type: int(1, WORLD.cols) },
      d: { type: int(1, WORLD.rows) },
      h: { type: int(1, 72) },
      kind: { type: oneOf(BUILDING_KINDS) },
      roof: { type: oneOf(ROOFS), default: 'flat' },
      seed: { type: int(0, 9), default: 0 },
    },
    render: (a) =>
      `<div class="bldg bldg--${a.kind}" style="${style([
        ['x', a.x ?? 0],
        ['y', a.y ?? 0],
        ['w', a.w ?? 1],
        ['d', a.d ?? 1],
        ['h', a.h ?? 1],
        ['seed', a.seed ?? 0],
      ])}">` +
      span('bldg__shadow') +
      span('bldg__wall bldg__wall--s') +
      span('bldg__wall bldg__wall--e') +
      span('bldg__wall bldg__wall--w') +
      roofMarkup(String(a.roof)) +
      '</div>',
  },
  'polis-tree': {
    parent: 'block',
    container: false,
    attrs: {
      x: { type: num(0, WORLD.cols) },
      y: { type: num(0, WORLD.rows) },
      kind: { type: oneOf(TREE_KINDS), default: 'round' },
      size: { type: num(0.5, 3), default: 1 },
    },
    render: (a) =>
      `<span class="tree tree--${a.kind}" style="${style([
        ['x', a.x ?? 0],
        ['y', a.y ?? 0],
        ['s', a.size ?? 1],
      ])}"></span>`,
  },
  'polis-lamp': {
    parent: 'block',
    container: false,
    attrs: {
      x: { type: num(0, WORLD.cols) },
      y: { type: num(0, WORLD.rows) },
    },
    render: (a) => `<span class="lamp" style="${style([
      ['x', a.x ?? 0],
      ['y', a.y ?? 0],
    ])}"></span>`,
  },
  'polis-car': {
    parent: 'world',
    container: false,
    attrs: {
      route: { type: oneOf(ROUTES) },
      delay: { type: num(-600, 600), default: 0 },
      paint: { type: hexColour, default: '#d8d2c4' },
    },
    render: (a) =>
      `<div class="car car--${a.route}" style="--delay:${a.delay}s;--paint:${a.paint}">` +
      ['front', 'back', 'left', 'right', 'top'].map((f) => span(`car__face car__face--${f}`)).join('') +
      '</div>',
  },
};

/**
 * @typedef {object} Node
 * @property {string} name
 * @property {number} start      Offset of `<` of the start tag.
 * @property {number} innerStart Offset after the start tag.
 * @property {number} innerEnd   Offset of the end tag (or innerStart if self-closing).
 * @property {number} end        Offset after the end tag.
 * @property {Record<string, Value>} attrs
 * @property {Node[]} children
 */

/**
 * Validates attributes of one start tag against the component spec.
 * @param {string} name
 * @param {Component} spec
 * @param {import('./markup.js').Attr[]} attrs
 * @param {(index: number) => import('./errors.js').SourcePos} at
 * @param {number} tagIndex
 * @returns {Record<string, Value>}
 */
function parseAttrs(name, spec, attrs, at, tagIndex) {
  /** @type {Record<string, Value>} */
  const out = {};
  const seen = new Set();
  for (const attr of attrs) {
    const def = spec.attrs[attr.name];
    if (!def) {
      throw new BuildError(
        `unknown attribute "${attr.name}" on <${name}>; allowed: ${Object.keys(spec.attrs).join(', ')}`,
        at(attr.index),
      );
    }
    if (seen.has(attr.name)) throw new BuildError(`duplicate attribute "${attr.name}"`, at(attr.index));
    seen.add(attr.name);
    if (attr.value === null) throw new BuildError(`attribute "${attr.name}" needs a value`, at(attr.index));
    const value = def.type.parse(attr.value.trim());
    if (value === undefined) {
      throw new BuildError(`"${attr.name}" must be ${def.type.describe}, got "${attr.value}"`, at(attr.index));
    }
    out[attr.name] = value;
  }
  for (const [key, def] of Object.entries(spec.attrs)) {
    if (key in out) continue;
    if (def.default === undefined) throw new BuildError(`missing attribute "${key}" on <${name}>`, at(tagIndex));
    out[key] = def.default;
  }
  return out;
}

/**
 * @param {Record<string, Value>} a
 * @param {Record<string, Value>} b
 */
const overlaps = (a, b) =>
  Number(a.x) < Number(b.x) + Number(b.w) &&
  Number(b.x) < Number(a.x) + Number(a.w) &&
  Number(a.y) < Number(b.y) + Number(b.d) &&
  Number(b.y) < Number(a.y) + Number(a.d);

/**
 * Checks placement rules that involve more than one tag.
 * @param {Node} node
 * @param {Node | null} parent
 * @param {(index: number) => import('./errors.js').SourcePos} at
 * @param {string} html
 */
function checkPlacement(node, parent, at, html) {
  const spec = /** @type {Component} */ (COMPONENTS[node.name]);
  const a = node.attrs;
  const pos = at(node.start);
  if (spec.parent === 'block' && parent?.name !== 'polis-block') {
    throw new BuildError(`<${node.name}> must be inside <polis-block>`, pos);
  }
  if (spec.parent === 'world' && parent !== null) {
    throw new BuildError(`<${node.name}> cannot be inside <${parent.name}>`, pos);
  }
  if (node.name === 'polis-block') {
    if (Number(a.x) + Number(a.w) > WORLD.cols) {
      throw new BuildError(`block leaves the world: x + w = ${Number(a.x) + Number(a.w)} > ${WORLD.cols}`, pos);
    }
    if (Number(a.y) + Number(a.d) > WORLD.rows) {
      throw new BuildError(`block leaves the world: y + d = ${Number(a.y) + Number(a.d)} > ${WORLD.rows}`, pos);
    }
  }
  if (parent && node.name === 'polis-building') {
    const b = parent.attrs;
    if (Number(a.x) + Number(a.w) > Number(b.w)) {
      throw new BuildError(`building does not fit in its block: x + w = ${Number(a.x) + Number(a.w)} > ${b.w}`, pos);
    }
    if (Number(a.y) + Number(a.d) > Number(b.d)) {
      throw new BuildError(`building does not fit in its block: y + d = ${Number(a.y) + Number(a.d)} > ${b.d}`, pos);
    }
    for (const other of parent.children) {
      if (other === node) break;
      if (other.name === 'polis-building' && overlaps(a, other.attrs)) {
        throw new BuildError(`building overlaps the building at line ${positionAt(html, other.start).line}`, pos);
      }
    }
  }
  if (parent && (node.name === 'polis-tree' || node.name === 'polis-lamp')) {
    const b = parent.attrs;
    if (Number(a.x) > Number(b.w) || Number(a.y) > Number(b.d)) {
      throw new BuildError(`<${node.name}> at (${a.x}, ${a.y}) is outside its ${b.w}x${b.d} block`, pos);
    }
  }
}

/**
 * Expands every <polis-*> component in `html`.
 * @param {string} html
 * @param {string} file Name used in error messages.
 * @returns {string}
 */
export function expandComponents(html, file) {
  /** @param {number} index */
  const at = (index) => ({ file, ...positionAt(html, index) });
  /** @type {Node[]} */
  const roots = [];
  /** @type {Node[]} */
  const stack = [];

  for (const token of scanTags(html)) {
    if (token.kind === 'raw' || !token.name.startsWith('polis-')) continue;
    if (token.kind === 'close') {
      const open = stack.pop();
      if (!open) throw new BuildError(`unexpected </${token.name}> with no open component`, at(token.index));
      if (open.name !== token.name) {
        throw new BuildError(`unexpected </${token.name}>, expected </${open.name}>`, at(token.index));
      }
      open.innerEnd = token.index;
      open.end = token.end;
      continue;
    }
    const spec = COMPONENTS[token.name];
    if (!spec) throw new BuildError(`unknown component <${token.name}>`, at(token.index));
    if (!token.terminated) throw new BuildError(`<${token.name}> start tag is not terminated`, at(token.index));
    const parent = stack.at(-1) ?? null;
    /** @type {Node} */
    const node = {
      name: token.name,
      start: token.index,
      innerStart: token.end,
      innerEnd: token.end,
      end: token.end,
      attrs: parseAttrs(token.name, spec, token.attrs, at, token.index),
      children: [],
    };
    (parent ? parent.children : roots).push(node);
    checkPlacement(node, parent, at, html);
    if (!token.selfClosing) stack.push(node);
  }
  const unclosed = stack[0];
  if (unclosed) throw new BuildError(`<${unclosed.name}> is never closed`, at(unclosed.start));

  /**
   * @param {number} from
   * @param {number} to
   * @param {Node[]} nodes
   * @returns {string}
   */
  const renderRange = (from, to, nodes) => {
    let out = '';
    let cursor = from;
    for (const node of nodes) {
      out += html.slice(cursor, node.start) + renderNode(node);
      cursor = node.end;
    }
    return out + html.slice(cursor, to);
  };

  /**
   * @param {Node} node
   * @returns {string}
   */
  const renderNode = (node) => {
    const spec = /** @type {Component} */ (COMPONENTS[node.name]);
    const inner = renderRange(node.innerStart, node.innerEnd, node.children);
    if (!spec.container && inner.trim() !== '') {
      throw new BuildError(`<${node.name}> cannot have content`, at(node.start));
    }
    return spec.render(node.attrs, inner);
  };

  return renderRange(0, html.length, roots);
}
