/* LT Data Consulting: switch language and keep the exact reading position.
   The page is split into blocks (hero and sections) that exist in the same
   order in both languages; we remember which block is under the menu bar and
   how far into it the reader is, then restore the same spot on the other page. */
(function () {
  var KEY = 'lt-reading-pos';
  var OFFSET = 80; // height of the fixed menu bar plus a little margin

  var COARSE = 'header.cs-hero, section';
  var FINE = 'h1, h2, h3, p, li, blockquote, figure, .stat-card, .credential-item, .service-card, ' +
             '.portfolio-card, .testimonial, .contact-item, .cs-step, .cs-tile, .cs-result, .cs-meta > div, .cs-more-grid a';
  // Elements that exist only in one language (translations of quotes) are skipped,
  // so both pages count the same elements in the same order
  var SKIP = '.testimonial-tr';
  function visible(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel))
      .filter(function (el) { return el.offsetParent !== null && el.offsetHeight > 0 && !el.matches(SKIP); });
  }
  function blocks() { return visible(COARSE); }
  function pageTop(el) { return el.getBoundingClientRect().top + window.pageYOffset; }

  // Locate the reading line inside a list: the smallest element that contains it,
  // or, if it falls in a gap, the next element below it
  function locate(list, y) {
    var best = -1, bestH = Infinity, next = -1;
    for (var i = 0; i < list.length; i++) {
      var t = pageTop(list[i]), h = list[i].offsetHeight;
      if (y >= t && y < t + h && h < bestH) { best = i; bestH = h; }
      if (next < 0 && t > y) next = i;
    }
    if (best >= 0) return { i: best, r: (y - pageTop(list[best])) / list[best].offsetHeight };
    if (next >= 0) return { i: next, r: 0, gap: pageTop(list[next]) - y };
    return null;
  }

  function readPosition() {
    var y = window.pageYOffset + OFFSET;
    var fine = visible(FINE), coarse = blocks();
    return {
      top: window.pageYOffset < 5,
      page: window.pageYOffset / Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
      nf: fine.length, f: locate(fine, y),
      nc: coarse.length, c: locate(coarse, y)
    };
  }

  function restore(pos) {
    var target;
    if (pos.top) target = 0;
    else {
      var fine = visible(FINE), coarse = blocks();
      var at = function (list, loc) {
        var el = list[loc.i];
        return pageTop(el) + loc.r * el.offsetHeight - (loc.gap || 0) - OFFSET;
      };
      if (pos.f && fine.length === pos.nf && fine[pos.f.i]) target = at(fine, pos.f);
      else if (pos.c && coarse.length === pos.nc && coarse[pos.c.i]) target = at(coarse, pos.c);
      else target = pos.page * (document.documentElement.scrollHeight - window.innerHeight);
    }
    var html = document.documentElement, prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, Math.max(0, target));
    html.style.scrollBehavior = prev;
  }

  // Outgoing: language links in the menu bar
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.lang-toggle a, .lang-switch a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var saved = false;
    try { sessionStorage.setItem(KEY, JSON.stringify(readPosition())); saved = true; } catch (err) {}
    if (!saved) return; // no storage: let the normal link work
    e.preventDefault();
    location.href = a.getAttribute('href').split('#')[0];
  }, true);

  // Incoming: restore the saved spot once the layout is ready
  var pending = null;
  try { pending = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch (err) {}
  if (pending) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    var active = true;
    var run = function () { if (active) restore(pending); };
    var stop = function () { active = false; };
    if (document.readyState !== 'loading') run(); else document.addEventListener('DOMContentLoaded', run);
    window.addEventListener('load', run);                       // again after images and fonts
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
    // Images above the reading point may finish loading later and push the text down:
    // keep re-aligning for a moment, but stop as soon as the visitor scrolls by hand
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { run(); });
      ro.observe(document.body);
      setTimeout(function () { ro.disconnect(); }, 2500);
    }
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) {
      window.addEventListener(ev, stop, { once: true, passive: true });
    });
    setTimeout(stop, 2500);
  }
})();
