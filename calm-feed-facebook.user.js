// ==UserScript==
// @name         Calm Feed for Facebook
// @namespace    https://github.com/lmxproject/calm-feed-facebook
// @version      0.1.1
// @description  Facebook on the web with only the people and pages you follow: no suggested posts, ads or Reels. Marketplace stays.
// @author       lmxproject
// @license      MIT
// @match        https://www.facebook.com/*
// @match        https://m.facebook.com/*
// @match        https://touch.facebook.com/*
// @run-at       document-start
// @inject-into  content
// @noframes
// @grant        GM.addStyle
// @grant        GM_addStyle
// @homepageURL  https://github.com/lmxproject/calm-feed-facebook
// @updateURL    https://raw.githubusercontent.com/lmxproject/calm-feed-facebook/main/calm-feed-facebook.user.js
// @downloadURL  https://raw.githubusercontent.com/lmxproject/calm-feed-facebook/main/calm-feed-facebook.user.js
// ==/UserScript==

// Calm Feed only hides and redirects things on the page you are already looking at.
// It makes no network requests and never reads your messages, password or cookies.

(function () {
  'use strict';

  // ---- Settings: change true/false to your liking ----
  const SETTINGS = {
    hideNotFollowing: true, // hide posts with a "Follow", "Join" or "Add friend" button
    hideSuggested: true, // hide "Suggested for you" and "People you may know"
    hideSponsored: true, // hide ads
    hideReels: true, // hide Reels in the feed and leave the Reels page
    hideVideoTab: true, // hide the Video tab and leave its endless feed
    hideOpenApp: true, // hide "Open app" buttons and bars
  };

  // Text Facebook shows on these posts (compared without case).
  // If your Facebook is not in English, add the exact text you see in your language.
  const LABELS = {
    notFollowing: ['follow', 'join', 'join group', 'add friend'],
    suggested: ['suggested for you', 'people you may know', 'suggested groups', 'suggested pages'],
    sponsored: ['sponsored'],
    reels: ['reels', 'reels and short videos', 'short videos'],
    reelsButton: ['reel', 'reels', 'reels and short videos', 'short videos'],
    videoButton: ['video', 'watch'],
    openApp: ['open app', 'open in app', 'open the app', 'use app', 'use the app', 'get app', 'get the app', 'open facebook', 'open facebook app'],
  };

  // Facebook serves different sites to different browsers, so look for a post in all of them.
  const POST_SELECTOR = 'article, [role="article"], [data-sigil~="story-div"], [data-tracking-duration-id]';
  // Links to one reel or video (/reel/123, /watch/?v=123) are left out on purpose.
  const REELS_NAV_SELECTOR = 'a[href="/reel"], a[href="/reel/"], a[href^="/reel/?"], a[href^="/reel?"], a[href="/reels"], a[href^="/reels/"], a[href^="/reels?"], a[href$="facebook.com/reel/"], a[href*="facebook.com/reel/?"], a[href*="facebook.com/reels/"], [role="tab"][aria-label^="reels" i]';
  const VIDEO_NAV_SELECTOR = 'a[href="/watch"], a[href^="/watch/"]:not([href*="v="]), a[href^="/watch?"]:not([href*="v="]), a[href*="facebook.com/watch"]:not([href*="v="]), [role="tab"][aria-label^="video" i], [role="tab"][aria-label^="watch" i]';
  const BUTTON_SELECTOR = 'a, button, [role="button"], [role="link"], [role="tab"]';
  const APP_LINK_SELECTOR = 'a[href*="apps.apple.com"], a[href*="itunes.apple.com"], a[href^="itms"], a[href^="fb://"], a[href^="intent://"]';
  const HIDDEN_ATTR = 'data-calm-feed-hidden';
  const GUARD_KEY = 'calmFeed.redirects';

  function navSelector(settings) {
    return [settings.hideReels && REELS_NAV_SELECTOR, settings.hideVideoTab && VIDEO_NAV_SELECTOR].filter(Boolean).join(', ');
  }

  // The words a piece of text is made of: "Page name · Follow" gives "page name" and "follow".
  function labelsIn(text) {
    return text.split(/[·•|]/).map(part => part.trim().toLowerCase()).filter(Boolean);
  }

  // Buttons found by their wording, for when the link address doesn't give them away.
  // Buttons inside a post are left alone, so a friend's reel keeps its controls.
  function findNavButtons(root, settings, labels) {
    const wanted = [
      ...(settings.hideReels ? labels.reelsButton : []),
      ...(settings.hideVideoTab ? labels.videoButton : []),
    ];
    if (!wanted.length) return [];
    return [...root.querySelectorAll(BUTTON_SELECTOR)].filter(el => {
      if (el.closest(POST_SELECTOR) || el.closest(`[${HIDDEN_ATTR}]`)) return false;
      const name = (el.getAttribute('aria-label') || el.textContent || '').split(',')[0].trim().toLowerCase();
      return wanted.includes(name);
    });
  }

  // "Open app" buttons. If the button sits in its own bar stuck to the screen, the bar goes too,
  // but never a bar with other things in it, such as the tab bar.
  function findOpenAppBlocks(root, labels) {
    const buttons = new Set(root.querySelectorAll(APP_LINK_SELECTOR));
    root.querySelectorAll(BUTTON_SELECTOR).forEach(el => {
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
      if (labels.openApp.includes(name)) buttons.add(el);
    });
    const blocks = new Set();
    buttons.forEach(button => {
      if (button.closest(`[${HIDDEN_ATTR}]`)) return;
      let block = button;
      for (let node = button; node && node !== button.ownerDocument.body; node = node.parentElement) {
        const position = getComputedStyle(node).position;
        if (position === 'fixed' || position === 'sticky') {
          if (node.textContent.trim().length <= 80 && !node.querySelector('[role="tablist"], [role="tab"]')) block = node;
          break;
        }
      }
      blocks.add(block);
    });
    return [...blocks];
  }

  // Where should this page send you instead? Returns a URL, or null to stay.
  // Single videos and reels still open, so links from friends keep working.
  function redirectFor(path, search, settings) {
    if (settings.hideReels && /^\/(reels(\/.*)?|reel\/?)$/.test(path)) return '/';
    if (settings.hideVideoTab && /^\/watch(\/|$)/.test(path) && !new URLSearchParams(search).get('v')) return '/';
    return null;
  }

  // Posts are only ever hidden on the home feed, so Marketplace, groups and profiles are left alone.
  function isFeedPath(path) {
    return path === '/' || path === '/home.php';
  }

  // Redirect bookkeeping, kept per tab. If Facebook keeps undoing a redirect, it is
  // switched off for this tab so the page can't reload forever.
  function readLog(storage) {
    try {
      return JSON.parse(storage.getItem(GUARD_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function writeLog(storage, log) {
    try {
      storage.setItem(GUARD_KEY, JSON.stringify(log));
    } catch (e) {}
  }

  function allowRedirect(to, storage) {
    const log = readLog(storage);
    const entry = log[to] || { tries: 0, off: false };
    if (entry.off) return false;
    entry.tries += 1;
    if (entry.tries > 3) entry.off = true;
    log[to] = entry;
    writeLog(storage, log);
    return !entry.off;
  }

  // Called once a redirect target has stayed in the address bar for a while.
  function redirectWorked(to, storage) {
    const log = readLog(storage);
    if (!log[to] || log[to].off) return;
    delete log[to];
    writeLog(storage, log);
  }

  // The whole post a label belongs to. Posts can be nested (a shared post inside a post),
  // so this takes the outermost one.
  function postFor(el) {
    let post = null;
    for (let node = el.closest(POST_SELECTOR); node; node = node.parentElement && node.parentElement.closest(POST_SELECTOR)) {
      post = node;
    }
    return post;
  }

  // For rows like "People you may know" that aren't a post: the biggest wrapper around
  // the label that sits next to the posts without containing any of them.
  function wrapperFor(el) {
    let node = el;
    for (let i = 0; i < 15; i++) {
      const parent = node.parentElement;
      if (!parent || parent === el.ownerDocument.body) return null;
      if (parent.querySelector(POST_SELECTOR)) return node;
      node = parent;
    }
    return null;
  }

  function findBlocks(root, settings, labels) {
    const postLabels = [
      ...(settings.hideNotFollowing ? labels.notFollowing : []),
      ...(settings.hideSponsored ? labels.sponsored : []),
    ];
    const rowLabels = [
      ...(settings.hideSuggested ? labels.suggested : []),
      ...(settings.hideReels ? labels.reels : []),
    ];
    const doc = root.ownerDocument || root;
    const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    const blocks = new Set();
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const found = labelsIn(text.nodeValue);
      const isRow = found.some(label => rowLabels.includes(label));
      if (!isRow && !found.some(label => postLabels.includes(label))) continue;
      const el = text.parentElement;
      if (!el || el.closest(`[${HIDDEN_ATTR}]`) || el.closest('[role="tablist"], nav')) continue;
      const block = postFor(el) || (isRow ? wrapperFor(el) : null);
      if (block) blocks.add(block);
    }
    return [...blocks];
  }

  function addStyle(css) {
    try {
      if (typeof GM !== 'undefined' && GM.addStyle) return void GM.addStyle(css);
      if (typeof GM_addStyle === 'function') return void GM_addStyle(css);
    } catch (e) {}
    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  function hide(el) {
    el.setAttribute(HIDDEN_ATTR, '');
    // Inline as well, in case Facebook's security rules block the style sheet.
    el.style.setProperty('display', 'none', 'important');
  }

  function start() {
    const nav = navSelector(SETTINGS);
    addStyle(`[${HIDDEN_ATTR}] { display: none !important; }` + (nav ? ` ${nav} { display: none !important; }` : ''));

    let lastHref = '';
    const checkRoute = () => {
      if (location.href === lastHref) return;
      lastHref = location.href;
      const here = location.pathname + location.search;
      if (here === '/') {
        setTimeout(() => {
          if (location.pathname + location.search === here) redirectWorked(here, sessionStorage);
        }, 3000);
      }
      const to = redirectFor(location.pathname, location.search, SETTINGS);
      if (to && allowRedirect(to, sessionStorage)) location.replace(to);
    };

    let scanQueued = false;
    const scan = () => {
      scanQueued = false;
      if (nav) document.querySelectorAll(nav).forEach(hide);
      if (!document.body) return;
      findNavButtons(document.body, SETTINGS, LABELS).forEach(hide);
      if (SETTINGS.hideOpenApp) findOpenAppBlocks(document.body, LABELS).forEach(hide);
      if (isFeedPath(location.pathname)) findBlocks(document.body, SETTINGS, LABELS).forEach(hide);
    };

    // Facebook changes pages without reloading, so keep watching the address and the page.
    checkRoute();
    setInterval(checkRoute, 300);
    window.addEventListener('popstate', checkRoute);
    new MutationObserver(() => {
      checkRoute();
      if (!scanQueued) {
        scanQueued = true;
        setTimeout(scan, 300);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  const onFacebook = typeof location !== 'undefined' && /(^|\.)facebook\.com$/.test(location.hostname);
  if (onFacebook) start();
  else globalThis.CalmFeed = { redirectFor, isFeedPath, navSelector, findNavButtons, findOpenAppBlocks, allowRedirect, redirectWorked, findBlocks, SETTINGS, LABELS };
})();
