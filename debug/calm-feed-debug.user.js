// ==UserScript==
// @name         Calm Feed page info
// @namespace    https://github.com/lmxproject/calm-feed-facebook
// @version      0.1.0
// @description  Helper for fixing Calm Feed: shows how Facebook's page is built, without post contents. Remove it when you're done.
// @author       lmxproject
// @license      MIT
// @match        https://www.facebook.com/*
// @match        https://m.facebook.com/*
// @match        https://touch.facebook.com/*
// @run-at       document-idle
// @inject-into  content
// @noframes
// @grant        none
// ==/UserScript==

// Sends nothing anywhere: it only fills a box on your screen for you to copy.
// It leaves out post text and names, keeping just page structure and short button words.

(function () {
  'use strict';

  const KEYWORDS = /reel|video|watch|open|app\b|follow|join|suggest|sponsor|friend|people you/i;
  const COUNTS = ['article', '[role="article"]', '[role="feed"]', '[data-sigil~="story-div"]', '[data-tracking-duration-id]',
    '[data-pull-to-refresh-action-id]', '[data-mcomponent]', '#screen-root', '[role="tablist"]', '[role="tab"]', '[role="button"]', 'nav'];

  // Only single short words and known button wording, never sentences or full names.
  function safeText(text) {
    const clean = text.trim().replace(/\s+/g, ' ');
    if (!clean) return '';
    const parts = clean.split(/[·•|]/).map(part => part.trim()).filter(Boolean);
    const kept = parts.map(part => {
      if (part.length <= 30 && KEYWORDS.test(part)) return part;
      if (part.length <= 14 && !part.includes(' ') && /^[\p{Ll}]/u.test(part)) return part;
      return '…';
    });
    return kept.join(' · ');
  }

  function safeHref(href) {
    if (!href) return '';
    try {
      const url = new URL(href, location.href);
      const first = url.pathname.split('/')[1] || '';
      const known = /^(reel|reels|watch|marketplace|groups|friends|notifications|messages|menu|home\.php|stories|search|bookmarks)$/.test(first);
      const path = known ? '/' + first : url.pathname === '/' ? '/' : '/…';
      const keys = [...url.searchParams.keys()].join(',');
      return (url.hostname.endsWith('facebook.com') ? '' : url.hostname) + path + (keys ? '?' + keys : '');
    } catch (e) {
      return '?';
    }
  }

  function describe(el) {
    const bits = [el.tagName.toLowerCase()];
    if (el.id && !/\d{4}/.test(el.id)) bits.push('#' + el.id);
    for (const name of ['role', 'data-sigil', 'data-type', 'data-mcomponent', 'data-pagelet']) {
      if (el.hasAttribute(name)) bits.push(`${name}=${el.getAttribute(name).slice(0, 30)}`);
    }
    for (const name of ['data-tracking-duration-id', 'data-focusable', 'data-action-id', 'data-screen-id']) {
      if (el.hasAttribute(name)) bits.push(name);
    }
    if (el.hasAttribute('aria-label')) bits.push(`aria="${safeText(el.getAttribute('aria-label'))}"`);
    if (el.tagName === 'A') bits.push(`href=${safeHref(el.getAttribute('href'))}`);
    const position = getComputedStyle(el).position;
    if (position === 'fixed' || position === 'sticky') bits.push(position.toUpperCase());
    return bits.join(' ');
  }

  function chain(el, depth) {
    const out = [];
    for (let node = el; node && node !== document.body && out.length < depth; node = node.parentElement) out.push(describe(node));
    return out.join(' < ');
  }

  // A post's shape, indented, with its text cut down to safeText.
  function outline(el, depth, lines, limit) {
    if (lines.length >= limit || depth > 9) return;
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join(' ');
    const words = safeText(own);
    const info = describe(el);
    if (el.children.length !== 1 || words || info.includes(' ')) lines.push(' '.repeat(depth) + info + (words ? ` "${words}"` : ''));
    for (const child of el.children) outline(child, depth + 1, lines, limit);
  }

  function report() {
    const out = [];
    out.push(`host ${location.hostname} path ${location.pathname === '/' ? '/' : '/…'} lang ${document.documentElement.lang} body.class ${document.body.className.slice(0, 80)}`);
    out.push('COUNTS ' + COUNTS.map(s => `${s}=${document.querySelectorAll(s).length}`).join('  '));

    out.push('\nFIXED/STICKY');
    [...document.body.querySelectorAll('*')].filter(el => /fixed|sticky/.test(getComputedStyle(el).position)).slice(0, 15).forEach(el => {
      const r = el.getBoundingClientRect();
      out.push(`${describe(el)} [y${Math.round(r.top)} h${Math.round(r.height)} w${Math.round(r.width)}] "${safeText(el.textContent.slice(0, 200))}"`);
    });

    out.push('\nTABS AND MENU BUTTONS');
    [...document.querySelectorAll('[role="tab"], nav a, [role="tablist"] a')].slice(0, 25).forEach(el => out.push(describe(el) + ` "${safeText(el.textContent)}"`));

    out.push('\nKEYWORD MATCHES');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let text = walker.nextNode(); text && seen.size < 40; text = walker.nextNode()) {
      if (!KEYWORDS.test(text.nodeValue) || text.parentElement.closest('#calm-feed-debug, script, style')) continue;
      const shown = safeText(text.nodeValue);
      if (!shown.replace(/[…·\s]/g, '')) continue;
      const line = `"${shown}" in ${chain(text.parentElement, 5)}`;
      if (!seen.has(line)) { seen.add(line); out.push(line); }
    }

    out.push('\nPOST SHAPE');
    const post = document.querySelector('[data-tracking-duration-id], [data-sigil~="story-div"], article, [role="article"]');
    if (post) {
      const lines = [];
      outline(post, 0, lines, 45);
      out.push(...lines);
    } else {
      out.push('no post found');
    }
    return out.join('\n').slice(0, 14000);
  }

  function show() {
    const panel = document.createElement('div');
    panel.id = 'calm-feed-debug';
    panel.style.cssText = 'position:fixed;inset:10% 8px auto 8px;z-index:2147483647;background:#fff;color:#000;border:2px solid #000;padding:8px;font:13px system-ui;';
    const box = document.createElement('textarea');
    box.value = report();
    box.readOnly = true;
    box.style.cssText = 'width:100%;height:50vh;font:11px monospace;box-sizing:border-box;';
    const copy = document.createElement('button');
    copy.textContent = 'Copy';
    copy.style.cssText = 'padding:10px 20px;margin:8px 8px 0 0;font-size:16px;';
    copy.onclick = () => {
      box.select();
      box.setSelectionRange(0, box.value.length);
      const done = () => { copy.textContent = 'Copied'; };
      if (navigator.clipboard) navigator.clipboard.writeText(box.value).then(done, () => document.execCommand('copy') && done());
      else if (document.execCommand('copy')) done();
    };
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.style.cssText = copy.style.cssText;
    close.onclick = () => panel.remove();
    panel.append(box, copy, close);
    document.body.appendChild(panel);
  }

  const button = document.createElement('button');
  button.textContent = 'Page info';
  button.style.cssText = 'position:fixed;top:60px;right:8px;z-index:2147483646;padding:8px 12px;font-size:14px;background:#ffeb3b;color:#000;border:1px solid #000;border-radius:6px;';
  button.onclick = show;
  document.body.appendChild(button);
})();
