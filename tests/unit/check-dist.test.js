import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanHtml, scanCss, checkDist, checkRelativeUrls } from '../../tools/lib/check-dist.js';

/** @param {import('../../tools/lib/check-dist.js').Violation[]} vs */
const rules = (vs) => vs.map((v) => v.rule);

describe('scanHtml: script tags', () => {
  test('flags a plain script element with its position', () => {
    const vs = scanHtml('<p>hi</p>\n  <script>alert(1)</script>', 'a.html');
    assert.deepEqual(rules(vs), ['script-tag']);
    assert.equal(vs[0]?.line, 2);
    assert.equal(vs[0]?.column, 3);
    assert.equal(vs[0]?.file, 'a.html');
  });

  test('is case-insensitive and catches external scripts', () => {
    assert.deepEqual(rules(scanHtml('<SCRIPT src="x.js"></SCRIPT>', 'a.html')), ['script-tag']);
    assert.deepEqual(rules(scanHtml('<ScRiPt\nsrc=x>', 'a.html')), ['script-tag']);
  });

  test('catches script inside inline SVG', () => {
    assert.deepEqual(rules(scanHtml('<svg><script>x()</script></svg>', 'a.svg')), ['script-tag']);
  });

  test('ignores escaped text and comments', () => {
    assert.deepEqual(scanHtml('<p>&lt;script&gt; is escaped</p>', 'a.html'), []);
    assert.deepEqual(scanHtml('<!-- <script>old()</script> -->', 'a.html'), []);
  });

  test('does not confuse similar tag names', () => {
    assert.deepEqual(scanHtml('<scripts-list></scripts-list><noscript></noscript>', 'a.html'), []);
  });
});

describe('scanHtml: event handler attributes', () => {
  test('flags quoted, unquoted and uppercase handlers', () => {
    assert.deepEqual(rules(scanHtml('<div onclick="go()">x</div>', 'a.html')), ['event-handler']);
    assert.deepEqual(rules(scanHtml('<img src=x ONERROR=alert(1)>', 'a.html')), ['event-handler']);
    assert.deepEqual(rules(scanHtml('<body\n  onload = "x()">', 'a.html')), ['event-handler']);
  });

  test('flags SVG onload', () => {
    assert.deepEqual(rules(scanHtml('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"/>', 'f.svg')), [
      'event-handler',
    ]);
  });

  test('allows attributes and text that merely contain "on"', () => {
    assert.deepEqual(scanHtml('<div data-on="x" aria-controls="on" data-one="1">onboarding onclick=</div>', 'a.html'), []);
  });

  test('rejects any on* attribute, including handlers browsers may add later', () => {
    assert.deepEqual(rules(scanHtml('<div onscrollsnapchange="x()" onfuture="y"></div>', 'a.html')), [
      'event-handler',
      'event-handler',
    ]);
  });

  test('a ">" inside a quoted value does not end the tag early', () => {
    assert.deepEqual(rules(scanHtml('<a title="a > b" onmouseover="x()">t</a>', 'a.html')), ['event-handler']);
  });

  test('reports the attribute position', () => {
    const [v] = scanHtml('<a\n   href="#" onfocus="x()">', 'a.html');
    assert.equal(v?.line, 2);
    assert.equal(v?.column, 13);
  });
});

describe('scanHtml: javascript: URLs', () => {
  test('flags direct, mixed-case and padded schemes', () => {
    assert.deepEqual(rules(scanHtml('<a href="javascript:void(0)">x</a>', 'a.html')), ['javascript-url']);
    assert.deepEqual(rules(scanHtml('<a href="  JaVaScRiPt:x">x</a>', 'a.html')), ['javascript-url']);
  });

  test('flags entity-encoded and whitespace-split schemes', () => {
    assert.deepEqual(rules(scanHtml('<a href="java&#x73;cript:x">x</a>', 'a.html')), ['javascript-url']);
    assert.deepEqual(rules(scanHtml('<a href="&#106;avascript&colon;x">x</a>', 'a.html')), ['javascript-url']);
    assert.deepEqual(rules(scanHtml('<a href="java\tscr&#10;ipt:x">x</a>', 'a.html')), ['javascript-url']);
  });

  test('flags SVG animation that writes a javascript: href', () => {
    assert.deepEqual(rules(scanHtml('<animate attributeName="href" to="javascript:x()"/>', 'f.svg')), [
      'javascript-url',
    ]);
  });

  test('flags meta refresh to a javascript: URL', () => {
    const html = '<meta http-equiv="refresh" content="0; url=javascript:x()">';
    assert.deepEqual(rules(scanHtml(html, 'a.html')), ['javascript-url']);
  });

  test('allows ordinary URLs and prose mentioning JavaScript', () => {
    assert.deepEqual(scanHtml('<a href="https://example.com/javascript">x</a>', 'a.html'), []);
    assert.deepEqual(scanHtml('<p>javascript: is a URL scheme</p><img alt="no javascript here">', 'a.html'), []);
  });

  test('scans inline style attributes and style elements as CSS', () => {
    assert.deepEqual(rules(scanHtml('<div style="background:url(javascript:x)"></div>', 'a.html')), [
      'javascript-url',
    ]);
    assert.deepEqual(rules(scanHtml('<style>\n.a{background:url("javascript:x")}</style>', 'a.html')), [
      'javascript-url',
    ]);
  });
});

describe('scanHtml: embedded browsing contexts', () => {
  test('flags iframe, object and embed', () => {
    assert.deepEqual(rules(scanHtml('<iframe src="x.html"></iframe><object data="x"></object><embed src="y">', 'a.html')), [
      'embedded-content',
      'embedded-content',
      'embedded-content',
    ]);
  });
});

describe('scanCss', () => {
  test('flags javascript: in url() with quotes, spaces and escapes', () => {
    assert.deepEqual(rules(scanCss('a{b:url(javascript:x)}', 'a.css')), ['javascript-url']);
    assert.deepEqual(rules(scanCss('a{b:url(  "JAVASCRIPT:x" )}', 'a.css')), ['javascript-url']);
    assert.deepEqual(rules(scanCss('a{b:url(\\6a avascript:x)}', 'a.css')), ['javascript-url']);
  });

  test('flags @import of a javascript: URL', () => {
    assert.deepEqual(rules(scanCss('@import "javascript:x";', 'a.css')), ['javascript-url']);
  });

  test('reports line and column', () => {
    const [v] = scanCss('a{}\nb{c:1;d:url(javascript:x)}', 'a.css');
    assert.equal(v?.line, 2);
    assert.equal(v?.column, 9);
  });

  test('allows normal CSS', () => {
    assert.deepEqual(scanCss('a{background:url(favicon.svg)}/* javascript: in a comment */', 'a.css'), []);
  });
});

describe('checkRelativeUrls', () => {
  test('flags root-relative and protocol-relative URLs', () => {
    const vs = checkRelativeUrls('<link href="/polis.css"><img src="//cdn.example/x.png">', 'a.html');
    assert.deepEqual(rules(vs), ['absolute-url', 'absolute-url']);
  });

  test('allows relative paths, fragments and external links', () => {
    const html = '<link href="polis.css"><a href="#city"></a><a href="./docs/"></a><a href="https://github.com/TIENDUNG21">x</a>';
    assert.deepEqual(checkRelativeUrls(html, 'a.html'), []);
  });
});

describe('checkDist', () => {
  test('walks the directory and reports every rule with relative file names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'polis-dist-'));
    try {
      writeFileSync(join(dir, 'index.html'), '<link rel="stylesheet" href="polis.css"><p>ok</p>');
      writeFileSync(join(dir, 'polis.css'), 'a{color:red}');
      writeFileSync(join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
      assert.deepEqual(checkDist(dir), []);

      mkdirSync(join(dir, 'sub'));
      writeFileSync(join(dir, 'sub', 'app.mjs'), 'export {}');
      writeFileSync(join(dir, 'bad.svg'), '<svg onload="x()"/>');
      writeFileSync(join(dir, 'index.html'), '<link href="/polis.css"><script></script>');
      const vs = checkDist(dir);
      assert.deepEqual(rules(vs).sort(), ['absolute-url', 'event-handler', 'js-file', 'script-tag']);
      assert.ok(vs.some((v) => v.file === 'sub/app.mjs'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('throws a clear error when the directory does not exist', () => {
    assert.throws(() => checkDist(join(tmpdir(), 'polis-missing-dir-xyz')), /does not exist/);
  });
});
