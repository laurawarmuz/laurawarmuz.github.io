// Laura Warmuz · p*rtfolio
document.documentElement.classList.add('js');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- Cover: the cursor grabs the corner and shrinks the box ---------- */
const cover = $('.cover');
const coverWord = $('#coverWord');
const selRect = $('#selRect');
const rotLine = $('#rotLine');
const rotKnob = $('#rotKnob');
const handles = $$('.hd').map(el => ({ el, u: el.dataset.u.split(' ').map(Number) }));
const cursor = $('#cursor');
const cursorArrow = $('#cursorArrow');
const cursorResize = $('#cursorResize');
const memojiGirl = $('#memojiGirl');
const memojiBubble = $('#memojiBubble');
const coverFoot = $('#coverFoot');

// iMessage-style bubbles: each bubble hugs its text with even padding and tight line spacing;
// the right edge and the tail stay where they are, only the newest message keeps its tail
const BUBBLE = { right: 458, bottom: 141, padL: 18, padR: 22, line: 30, top: 31, base: 18, radius: 26 };
const bubblePath = (l, t, r, b, tail) => {
  const k = Math.min(BUBBLE.radius, (b - t) / 2);
  const top = `M${l + k} ${t}H${r - k}A${k} ${k} 0 0 1 ${r} ${t + k}`;
  const left = `H${l + k}A${k} ${k} 0 0 1 ${l} ${b - k}V${t + k}A${k} ${k} 0 0 1 ${l + k} ${t}Z`;
  if (!tail) return `${top}V${b - k}A${k} ${k} 0 0 1 ${r - k} ${b}${left}`;
  return `${top}V${Math.max(b - 33, t + k)}C${r} ${b - 15} ${r + 5} ${b - 4} ${r + 14} ${b + 1}` +
         `C${r + 1} ${b + 2} ${r - 11} ${b - 2} ${r - 19} ${b - 7}C${r - 27} ${b - 2} ${r - 36} ${b} ${r - 45} ${b}${left}`;
};
const fitBubble = textGroup => {
  const lines = $$('text', textGroup);
  const w = textGroup.getBBox().width;
  const b = BUBBLE.bottom, r = BUBBLE.right;
  const firstBase = b - BUBBLE.base - BUBBLE.line * (lines.length - 1);
  const t = firstBase - BUBBLE.top;
  const l = r - BUBBLE.padR - w - BUBBLE.padL;
  lines.forEach((el, i) => { el.setAttribute('x', l + BUBBLE.padL); el.setAttribute('y', firstBase + BUBBLE.line * i); });
  return { tail: bubblePath(l, t, r, b, true), plain: bubblePath(l, t, r, b, false), height: b - t };
};
const bubbleOne = $('#bubbleOne');
const bubbleOnePath = $('#bubbleOnePath');
const memojiBubble2 = $('#memojiBubble2');
const BUBBLE_ONE = fitBubble($('#bubbleOneText'));
const BUBBLE_TWO = fitBubble($('#bubbleTwoText'));
bubbleOnePath.setAttribute('d', BUBBLE_ONE.tail);
$('#bubbleTwoPath').setAttribute('d', BUBBLE_TWO.tail);
bubbleOne.style.setProperty('--lift', `${-(BUBBLE_TWO.height + 5)}px`);
// the second message arrives on its own once the cover has been scrolled all the way,
// after a short pause, like a real incoming message
let secondTimer = null, secondShown = false;
const setSecond = on => {
  memojiBubble2.classList.toggle('show', on);
  bubbleOne.classList.toggle('lifted', on);
  bubbleOnePath.setAttribute('d', on ? BUBBLE_ONE.plain : BUBBLE_ONE.tail);
};
const updateSecond = atEnd => {
  if (atEnd && !secondShown && !secondTimer) {
    secondTimer = setTimeout(() => { secondTimer = null; secondShown = true; setSecond(true); }, 700);
  } else if (!atEnd) {
    clearTimeout(secondTimer); secondTimer = null;
    if (secondShown) { secondShown = false; setSecond(false); }
  }
};
const menubar = $('#menubar');
const dock = $('#dock');

const BOX = { x: 272, y: 233, w: 1057, h: 297 };   // box at full size
const ANCHOR = { x: BOX.x, y: BOX.y + BOX.h };     // bottom left corner stays put
const END_SCALE = 1 / 2;                            // final size: 1/2 of the original
const CURSOR_START = { x: 1368, y: 563 };
// the timeline, as shares of the cover's scroll
const MOVE_END = 0.15;     // cursor reaches the top right handle
const RESIZE_END = 0.6;    // box has shrunk (girl, header and Dock arrive meanwhile)
const GRAB_END = 0.67;     // cursor has moved to the middle of the box
// from here to the end of the cover's scroll, the box is dragged down;
// once the scroll is complete she waves and the second message arrives (both timed)
// drag target: box centred between the bottom of the speech bubble and the top of the Dock
// (DRAG_Y depends on the window's shape, so layout() works it out)
let DRAG_Y = 135, DRAG_X = 0, BAR_H = 60;

/* ---------- Layout: the cover and the pages' menu bar fill the window ----------
   Everything is drawn in "cover units". Wide windows keep the PDF layout (1600 x 900),
   stretched with extra room on the sides or above; tall windows (phones, narrow split views)
   get a 600-unit-wide stack: menu bar on two rows, the word box on top, Memoji and Dock below. */
const TALL = window.matchMedia('(max-aspect-ratio: 9/10)');
const coverSvg = $('.cover-frame');
const setBar = (root, W, tall) => {
  const hh = tall ? 112 : 60, side = tall ? 16 : 29;
  $('.bar-bg', root).setAttribute('width', W);
  $('.bar-bg', root).setAttribute('height', hh);
  const rule = $('.hd-rule', root);
  const ry = root === menubar ? hh : hh - .5;
  rule.setAttribute('x1', side); rule.setAttribute('x2', W - side);
  rule.setAttribute('y1', ry); rule.setAttribute('y2', ry);
  const title = $('.hd-title', root);
  title.setAttribute('x', side); title.setAttribute('y', tall ? 40 : 42);
  const nav = $('.hd-nav', root), links = $$('.hd-link', nav);
  const widths = links.map(a => $('text', a).getBBox().width);
  const put = (a, x, w) => {
    $('text', a).setAttribute('x', x);
    const line = $('.hd-line', a); line.setAttribute('x', x); line.setAttribute('width', w);
  };
  if (!tall) {                                    // one row, right-aligned from their real widths
    let right = W - side;
    for (let i = links.length - 1; i >= 0; i--) { right -= widths[i]; put(links[i], right, widths[i]); right -= 56; }
    nav.removeAttribute('transform');
  } else {                                        // second row, spread across the width
    const total = widths.reduce((a, b) => a + b, 0), avail = W - side * 2;
    const k = Math.min(1, (avail - 3 * 18) / total), gap = (avail / k - total) / 3;
    let x = 0;
    links.forEach((a, i) => { put(a, x, widths[i]); x += widths[i] + gap; });
    nav.setAttribute('transform', `translate(${side} ${96 - 44 * k}) scale(${k})`);
  }
  return hh;
};
const layout = () => {
  const st = $('.cover-stick'), a = st.clientWidth / st.clientHeight, tall = TALL.matches;
  const W = tall ? 600 : a >= 16 / 9 ? 900 * a : 1600;
  const H = tall ? 600 / a : a >= 16 / 9 ? 900 : 1600 / a;
  coverSvg.setAttribute('viewBox', `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`);
  $('#coverBg').setAttribute('width', W); $('#coverBg').setAttribute('height', H);
  BAR_H = setBar(menubar, W, tall);
  const people = $('#people'), stage = $('#stage'), dockPos = $('#dockPos');
  const foot = $$('text', coverFoot);
  if (!tall) {
    const ox = (W - 1600) / 2, oyBox = (H - 900) / 2, oyGirl = H - 900;
    people.setAttribute('transform', `translate(${ox} ${oyGirl})`);   // her feet stay on the bottom edge
    stage.setAttribute('transform', `translate(${ox} ${oyBox})`);     // the word stays in the middle
    dockPos.setAttribute('transform', `translate(${ox} ${H - 900})`);
    // drag target: centred between the bottom of the speech bubble and the top of the Dock
    DRAG_Y = (378 + oyGirl + H - 96.5) / 2 - (ANCHOR.y + oyBox - BOX.h * END_SCALE / 2);
    DRAG_X = 0;
    [[29, 'start'], [W / 2 + 12, 'middle'], [W - 63, 'end']].forEach(([x, anchor], i) => {
      foot[i].setAttribute('x', x); foot[i].setAttribute('y', H - 44); foot[i].setAttribute('text-anchor', anchor); foot[i].removeAttribute('display');
    });
  } else {
    const k = Math.min(.58, H * .36 / 670);       // Memoji in the bottom right corner
    const px = W - 6 - 1537 * k, py = H - 900 * k;
    people.setAttribute('transform', `translate(${px} ${py}) scale(${k})`);
    const kd = .82;                               // Dock in the bottom left corner, clear of her
    dockPos.setAttribute('transform', `translate(${14 - 636 * kd} ${H - 14 - 878.5 * kd}) scale(${kd})`);
    const kb = (W - 60) / 1057;                   // the word box fills the width, above her messages
    const cy = (BAR_H + 20 + py + 175 * k) / 2 + 30;
    stage.setAttribute('transform', `translate(${30 - BOX.x * kb} ${cy - (BOX.y + BOX.h / 2) * kb}) scale(${kb})`);
    DRAG_Y = (BOX.y + BOX.h / 2) - (ANCHOR.y - BOX.h * END_SCALE / 2);   // dragged back to the middle of the space
    DRAG_X = (BOX.x + BOX.w / 2) - (ANCHOR.x + BOX.w * END_SCALE / 2);
    foot[0].setAttribute('x', 16); foot[2].setAttribute('x', W - 16);
    foot.forEach(t => t.setAttribute('y', H - 30));
    foot[1].setAttribute('display', 'none');
  }
  // the pages' menu bar is the same bar, at the same size
  const vb = $('.view-bar');
  vb.setAttribute('viewBox', `0 0 ${W.toFixed(1)} ${BAR_H}`);
  setBar(vb, W, tall);
  document.documentElement.classList.toggle('tall', tall);
  document.documentElement.style.setProperty('--bar-h', `${st.clientWidth * BAR_H / W}px`);
};

const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const phase = (p, a, b) => ease(clamp01((p - a) / (b - a)));

// her wave, as keyframes (degrees; the hand follows the forearm slightly later)
const ARM_KEYS = [[0, 0], [.18, -2.5], [.39, 1.5], [.6, -2], [.8, 1], [1, 0]];
const HAND_KEYS = [[0, 0], [.18, -8], [.39, 5], [.6, -7], [.8, 3], [1, 0]];
const keyframe = (keys, t) => {
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
};
const girlArm = $('.girl-arm');
const girlHand = $('.girl-hand');
// the wave plays on its own, once, when the cover has been scrolled all the way
// (so it doesn't depend on how fast you scroll); scrolling back resets it
const WAVE_MS = 2800;
let waveStart = null, waveDone = false, waveRaf = null;
const setWave = t => {
  girlArm.style.transform = `rotate(${keyframe(ARM_KEYS, t)}deg)`;
  girlHand.style.transform = `rotate(${keyframe(HAND_KEYS, clamp01((t - .06) / .94))}deg)`;
};
const waveStep = now => {
  if (waveStart === null) waveStart = now;
  const t = clamp01((now - waveStart) / WAVE_MS);
  setWave(t);
  if (t < 1) waveRaf = requestAnimationFrame(waveStep);
  else { waveRaf = null; waveDone = true; }
};
const updateWave = atEnd => {
  if (atEnd && !waveDone && !waveRaf) {
    waveStart = null;
    waveRaf = requestAnimationFrame(waveStep);
  } else if (!atEnd && (waveDone || waveRaf)) {
    cancelAnimationFrame(waveRaf); waveRaf = null; waveDone = false;
    setWave(0);
  }
};

const drawCover = () => {
  const range = cover.offsetHeight - window.innerHeight;
  const p = clamp01(-cover.getBoundingClientRect().top / range);

  const move = phase(p, 0, MOVE_END);
  const resize = phase(p, MOVE_END, RESIZE_END);
  const grab = phase(p, RESIZE_END, GRAB_END);
  const drag = phase(p, GRAB_END, 1);   // the box is dragged down with the last stretch of scroll
  const s = lerp(1, END_SCALE, resize);
  const dy = DRAG_Y * drag, dx = DRAG_X * drag;

  // box geometry: scaled towards the bottom left corner, then dragged down by dy
  const w = BOX.w * s, h = BOX.h * s, x = ANCHOR.x + dx, y = ANCHOR.y - h + dy;
  selRect.setAttribute('x', x);
  selRect.setAttribute('y', y);
  selRect.setAttribute('width', w);
  selRect.setAttribute('height', h);
  handles.forEach(({ el, u }) => {
    el.setAttribute('cx', x + u[0] * w);
    el.setAttribute('cy', y + u[1] * h);
  });
  const mid = x + w / 2;
  rotLine.setAttribute('x1', mid);
  rotLine.setAttribute('x2', mid);
  rotLine.setAttribute('y1', y - 129);
  rotLine.setAttribute('y2', y);
  rotKnob.setAttribute('cx', mid);
  rotKnob.setAttribute('cy', y - 141);
  coverWord.setAttribute('transform', `translate(${dx} ${dy}) translate(${ANCHOR.x} ${ANCHOR.y}) scale(${s}) translate(${-ANCHOR.x} ${-ANCHOR.y})`);

  // cursor: glide to the top right handle and resize, then go to the middle of the box and drag it
  const corner = { x: x + w, y: y };
  const centre = { x: x + w / 2, y: y + h / 2 };
  let cx = lerp(CURSOR_START.x, corner.x, move);
  let cy = lerp(CURSOR_START.y, corner.y, move);
  if (p > RESIZE_END) {
    const from = { x: ANCHOR.x + BOX.w * END_SCALE, y: ANCHOR.y - BOX.h * END_SCALE };
    cx = lerp(from.x, centre.x, grab);   // once grabbed, it rides along with the box
    cy = lerp(from.y, centre.y, grab);
  }
  cursor.setAttribute('transform', `translate(${cx} ${cy})`);
  const resizing = move >= 1 && p <= RESIZE_END;
  cursorArrow.setAttribute('visibility', resizing ? 'hidden' : 'visible');
  cursorResize.setAttribute('visibility', resizing ? 'visible' : 'hidden');

  // memoji walks in from the right edge of the screen while the box shrinks
  // (she starts fully outside the frame, so no fade is needed)...
  const slide = resize;
  memojiGirl.setAttribute('transform', `translate(${lerp(460, 0, slide)} 0)`);
  // ...and as soon as the cursor starts dragging the box down, the message pops up and she waves
  memojiBubble.classList.toggle('show', p > GRAB_END);
  // once the cover has been scrolled all the way, the second message arrives and pushes the first one up
  updateSecond(p >= 0.999);
  updateWave(p >= 0.999);

  // the cover becomes a Mac desktop: bottom text fades out,
  // menu bar drops in from the top and the Dock rises from the bottom
  coverFoot.setAttribute('opacity', 1 - slide);
  menubar.setAttribute('transform', `translate(0 ${lerp(-BAR_H - 4, 0, slide)})`);
  dock.setAttribute('transform', `translate(0 ${lerp(110, 0, slide)})`);
};

/* ---------- Reveal on scroll ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting) {
      en.target.classList.add('in');
      io.unobserve(en.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
$$('.reveal, .clip, .memoji').forEach(el => io.observe(el));

/* ---------- Cover animation follows the page scroll ---------- */
let ticking = false;
const onScroll = () => { drawCover(); ticking = false; };
window.addEventListener('scroll', () => {
  if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
}, { passive: true });
window.addEventListener('resize', () => { layout(); onScroll(); });
layout();
onScroll();

/* ---------- Pages: opened with the header buttons, not by scrolling ---------- */
const views = $('.views');
const viewEls = $$('.view');
const pageIds = viewEls.map(v => v.id);
const navLinks = $$('.view-bar .hd-link');
let activeView = null;

// inside a page: gentle parallax, and the page colour follows the project on screen
const onViewScroll = () => {
  if (!activeView) return;
  const vh = window.innerHeight;
  if (!reduced) {
    $$('[data-speed]', activeView).forEach(el => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.speed)).toFixed(1)}px, 0)`;
    });
  }
  let theme = '';
  $$('section[data-theme]', activeView).forEach(sec => {
    const r = sec.getBoundingClientRect();
    if (r.top < vh / 2 && r.bottom > vh / 2) theme = sec.dataset.theme;
  });
  if ((activeView.dataset.theme || '') !== theme) {
    if (theme) activeView.dataset.theme = theme; else delete activeView.dataset.theme;
  }
};
viewEls.forEach(v => v.addEventListener('scroll', () => requestAnimationFrame(onViewScroll), { passive: true }));

// height of a page under the menu bar, for the full-screen parts of the pages
const setBarHeight = () => views.style.setProperty('--page-h', `${views.clientHeight - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h'))}px`);
window.addEventListener('resize', setBarHeight);
const showPage = id => {
  activeView = viewEls.find(v => v.id === id) || null;
  viewEls.forEach(v => v.classList.toggle('active', v === activeView));
  navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
  const open = !!activeView;
  views.classList.toggle('open', open);
  views.setAttribute('aria-hidden', String(!open));
  document.documentElement.classList.toggle('view-open', open);
  if (open) { setBarHeight(); activeView.scrollTop = 0; onViewScroll(); }
};
const currentPage = () => {
  const id = location.hash.slice(1);
  return pageIds.includes(id) ? id : null;
};
// every "#page" link opens that page; "#desktop" closes it (without jumping the scroll)
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  // links to a spot inside the open page (e.g. a case study) just scroll that page
  const inPage = activeView && id && $(`#${CSS.escape(id)}`, activeView);
  if (inPage) {
    e.preventDefault();
    inPage.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    return;
  }
  if (!pageIds.includes(id) && id !== 'desktop') return;
  e.preventDefault();
  const target = pageIds.includes(id) ? `#${id}` : location.pathname + location.search;
  if (id !== currentPage()) history.pushState(null, '', target);
  showPage(pageIds.includes(id) ? id : null);
});
window.addEventListener('popstate', () => showPage(currentPage()));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && activeView) {
    history.pushState(null, '', location.pathname + location.search);
    showPage(null);
  }
});
// opened straight from a link (e.g. …/#about): finish the desktop behind it, then show the page
if (currentPage()) {
  history.scrollRestoration = 'manual';
  window.scrollTo(0, cover.offsetHeight - window.innerHeight);
  onScroll();
  showPage(currentPage());
}

/* ---------- About: "hello" over the photo behind glass, then the photo moves aside and clears, the name types, the intro appears ---------- */
(() => {
  const hero = $('.ab-hero');
  if (!hero) return;
  const pic = $('.ab-pic', hero), typed = $('.ab-typed', hero);
  const glass = $('.ab-lg', hero);
  const BLUR = 16;
  // 0 = behind the glass, 1 = clear; eased like the move so the glass melts away as the photo travels
  const sharpen = k => {
    glass.style.setProperty('--lg-blur', (BLUR * (1 - k)).toFixed(2) + 'px');
    glass.style.setProperty('--lg-rim', (1 - k).toFixed(3));
  };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  let blurRaf = 0;
  const unblur = () => {
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / MOVE_MS);
      sharpen(ease(t));
      blurRaf = t < 1 ? requestAnimationFrame(step) : 0;
    };
    blurRaf = requestAnimationFrame(step);
  };
  const NAME = 'Laura Warmuz Biernacka';
  const HELLO_MS = 3400, HOLD_MS = -250,   // negative: the photo starts moving as the last stroke lands
        MOVE_MS = 1300, TYPE_MS = 75;
  let timers = [], settled = false;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const place = r => Object.assign(pic.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  // first the photo covers the whole screen, then it moves into its slot next to the text
  const full = () => place({ left: 0, top: 0, width: hero.clientWidth, height: Math.min(hero.clientHeight, $('#about').clientHeight) });   // what is on screen
  const inSlot = () => {
    const h = hero.getBoundingClientRect(), r = $('.ab-slot', hero).getBoundingClientRect();
    place({ left: r.left - h.left, top: r.top - h.top, width: r.width, height: r.height });
  };
  const type = i => {
    typed.textContent = NAME.slice(0, i);
    if (i < NAME.length) later(() => type(i + 1), TYPE_MS + Math.random() * 60);
    else later(() => hero.classList.remove('typing'), 350);
  };
  const play = () => {
    timers.forEach(clearTimeout); timers = []; settled = false;
    cancelAnimationFrame(blurRaf); sharpen(0);
    hero.className = 'ab-hero';
    typed.textContent = '';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      typed.textContent = NAME; settled = true; sharpen(1);
      hero.classList.add('done', 'shown'); inSlot(); return;
    }
    full();
    later(() => hero.classList.add('hello'), 500);
    later(() => { settled = true; hero.classList.add('settle'); inSlot(); unblur(); }, 500 + HELLO_MS + HOLD_MS);
    later(() => { hero.classList.add('typing', 'shown'); type(1); }, 500 + HELLO_MS + HOLD_MS + MOVE_MS - 200);
  };
  window.addEventListener('resize', () => { if ($('#about').classList.contains('active')) (settled ? inSlot : full)(); });
  // play it every time the About page is opened
  new MutationObserver(() => {
    if ($('#about').classList.contains('active')) requestAnimationFrame(play);
    else { timers.forEach(clearTimeout); timers = []; }
  }).observe($('#about'), { attributes: true, attributeFilter: ['class'] });
  if ($('#about').classList.contains('active')) requestAnimationFrame(play);
})();

/* ---------- Software: filter the Applications panel by category or by typing ---------- */
(() => {
  const panel = $('.apps-panel');
  if (!panel) return;
  const search = $('.ap-search', panel);
  const buttons = $$('.ap-cats button', panel);
  const favs = $('.ap-favs', panel);
  const all = $$('.ap-all .app', panel);
  const empty = $('.ap-empty', panel);
  let cat = null;
  const apply = () => {
    const q = search.value.trim().toLowerCase();
    const filtering = !!(cat || q);
    favs.hidden = filtering;                     // favourites only show when nothing is filtered
    let shown = 0;
    all.forEach(li => {
      const ok = (!cat || li.dataset.cat === cat) && (!q || li.dataset.name.includes(q));
      li.hidden = !ok;
      if (ok) shown++;
    });
    empty.hidden = shown > 0;
  };
  buttons.forEach(b => b.addEventListener('click', () => {
    cat = cat === b.dataset.cat ? null : b.dataset.cat;   // click again to show everything
    buttons.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.cat === cat)));
    apply();
  }));
  search.addEventListener('input', apply);
})();

/* ---------- Projects Finder: a click selects the folder like in Finder, then it opens the project ---------- */
(() => {
  const folders = $$('.pj-folder');
  const select = a => folders.forEach(f => f.classList.toggle('sel', f === a));
  folders.forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    select(a);
    setTimeout(() => {
      $(a.hash).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    }, 320);
  }));
  // clicking the empty part of the window clears the selection
  $('.fd-grid').addEventListener('click', e => { if (!e.target.closest('.pj-folder')) select(null); });
})();

/* ---------- Contact: "No" never stays a no; "Yes" throws confetti and brings the contact details forward ---------- */
(() => {
  const hero = $('.ct-hero'), yesBtn = $('.ct-yes'), no = $('.ct-no');
  if (!hero) return;
  const reveal = $('.ct-reveal'), canvas = $('.ct-confetti'), ctx = canvas.getContext('2d');
  // the "No" runs away. It is pushed by the cursor like a magnet pushes another magnet:
  // the closer the cursor, the harder the push; it glides with a little friction and slides along the edges
  let off = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, cur = null, raf2 = 0, last = 0;
  const REACH = 220, PUSH = 7000, FRICTION = 4.5, PAD = 16, SAFE = 60;   // SAFE: the cursor never gets closer than this
  const move = (x, y) => { off = { x, y }; no.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; };
  const limits = () => {                          // how far it may go from its resting place
    const h = hero.getBoundingClientRect(), a = no.parentElement.getBoundingClientRect();
    const bx = a.left + no.offsetLeft, by = a.top + no.offsetTop, w = no.offsetWidth, hh = no.offsetHeight;
    return { minX: h.left + PAD - bx, maxX: h.right - PAD - w - bx, minY: h.top + PAD - by, maxY: h.bottom - PAD - hh - by, bx, by, w, h: hh };
  };
  // however fast the cursor comes, it never reaches the button: keep a clear gap around it
  const keepClear = (L, x, y) => {
    const wall = () => {
      if (x < L.minX) { x = L.minX; vel.x = 0; } else if (x > L.maxX) { x = L.maxX; vel.x = 0; }
      if (y < L.minY) { y = L.minY; vel.y = 0; } else if (y > L.maxY) { y = L.maxY; vel.y = 0; }
    };
    wall();
    if (!cur) return { x, y };
    const gap = () => {
      const l = L.bx + x, t = L.by + y;
      const nx = Math.max(l, Math.min(cur.x, l + L.w)), ny = Math.max(t, Math.min(cur.y, t + L.h));
      return { d: Math.hypot(cur.x - nx, cur.y - ny), ux: l + L.w / 2 - cur.x, uy: t + L.h / 2 - cur.y };
    };
    // step out until the gap is clear (a fast flick can even land the cursor on top of it)
    for (let i = 0, g = gap(); g.d < SAFE && i < 8; i++, g = gap()) {
      const n = Math.hypot(g.ux, g.uy) || 1, need = SAFE - g.d + Math.max(L.w, L.h) * (g.d === 0 ? .5 : 0) + 2;
      const px = x, py = y;
      x += g.ux / n * need; y += g.uy / n * need; wall();
      if (Math.hypot(x - px, y - py) < need * .5) {  // cornered: slip sideways instead
        const sideX = L.maxX - x > x - L.minX ? 1 : -1, sideY = L.maxY - y > y - L.minY ? 1 : -1;
        if (Math.abs(g.ux) > Math.abs(g.uy)) y += sideY * need; else x += sideX * need;
        wall();
      }
    }
    return { x, y };
  };
  const step = now => {
    const dt = Math.min(.04, (now - last) / 1000 || .016); last = now;
    const L = limits();
    if (cur) {
      const cx = L.bx + off.x + L.w / 2, cy = L.by + off.y + L.h / 2;
      let dx = cx - cur.x, dy = cy - cur.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < REACH) {
        const f = PUSH * Math.pow(1 - d / REACH, 1.5);
        dx /= d; dy /= d;
        vel.x += dx * f * dt; vel.y += dy * f * dt;
        // pinned against an edge: slip sideways along it, towards the side with more room
        const pinX = (dx < 0 && off.x <= L.minX + 1) || (dx > 0 && off.x >= L.maxX - 1);
        const pinY = (dy < 0 && off.y <= L.minY + 1) || (dy > 0 && off.y >= L.maxY - 1);
        if (pinX) vel.y += (L.maxY - off.y > off.y - L.minY ? 1 : -1) * f * dt;
        if (pinY) vel.x += (L.maxX - off.x > off.x - L.minX ? 1 : -1) * f * dt;
      }
    }
    const k = Math.exp(-FRICTION * dt);
    vel.x *= k; vel.y *= k;
    let x = off.x + vel.x * dt, y = off.y + vel.y * dt;
    ({ x, y } = keepClear(L, x, y));
    move(x, y);
    const near = cur && Math.hypot(L.bx + x + L.w / 2 - cur.x, L.by + y + L.h / 2 - cur.y) < REACH;
    raf2 = (near || Math.hypot(vel.x, vel.y) > 2) ? requestAnimationFrame(step) : 0;
  };
  const wake = () => { if (!raf2) { last = performance.now(); raf2 = requestAnimationFrame(step); } };
  const chase = e => {
    if (e.pointerType !== 'mouse') return;
    cur = { x: e.clientX, y: e.clientY };
    const p = keepClear(limits(), off.x, off.y);    // react on the spot, not a frame later
    move(p.x, p.y); wake();
  };
  hero.addEventListener('pointermove', chase);
  no.addEventListener('pointerenter', chase);
  hero.addEventListener('pointerleave', () => { cur = null; });
  // on a touch screen (or if it is somehow reached) a tap on "No" gives it a shove
  no.addEventListener('pointerdown', e => {
    e.preventDefault();
    const a = Math.random() * Math.PI * 2; vel.x += Math.cos(a) * 900; vel.y += Math.sin(a) * 900; wake();
  });
  no.addEventListener('click', e => e.preventDefault());
  yesBtn.addEventListener('click', () => yes());

  // confetti, Apple style: big glossy pieces (squares, strips, dots) shot in from both sides,
  // tumbling in 3D and drifting down slowly with a little sway
  const COLORS = ['#2D6BF6', '#5AC8FA', '#FEBC2E', '#FF9500', '#FF5F57', '#FF2D55', '#28C840', '#AF52DE', '#FDFDFD'];
  let parts = [], raf = 0, timers = [];
  const burst = (W, H) => {
    parts = [];
    const S = W / 100;                              // one "unit" is 1% of the frame width
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 70; i++) {
        const dir = side ? -1 : 1, a = (25 + Math.random() * 45) * Math.PI / 180, v = W * (.018 + Math.random() * .016);
        const kind = Math.random() < .2 ? 'dot' : Math.random() < .45 ? 'strip' : 'square';
        const w = kind === 'strip' ? S * (.45 + Math.random() * .3) : S * (1.1 + Math.random() * .9);
        parts.push({
          kind, x: side ? W + 20 : -20, y: H * (.5 + Math.random() * .4),
          vx: Math.cos(a) * v * dir, vy: -Math.sin(a) * v,
          w, h: kind === 'strip' ? S * (2.2 + Math.random() * 1.6) : kind === 'dot' ? w : w * (.7 + Math.random() * .5),
          r: Math.random() * 6.3, vr: (Math.random() - .5) * .12,
          flip: Math.random() * 6.3, vf: .05 + Math.random() * .08,
          sway: Math.random() * 6.3, c: COLORS[(i + side * 3) % COLORS.length]
        });
      }
    }
  };
  const tick = () => {
    const W = canvas.width, H = canvas.height, g = H * .00022;
    ctx.clearRect(0, 0, W, H);
    parts.forEach(p => {
      p.vy += g; p.vx *= .985; p.vy *= .985;           // air slows them, so they float down
      p.sway += .05; p.x += p.vx + Math.sin(p.sway) * W * .0006; p.y += p.vy;
      p.r += p.vr; p.flip += p.vf;
      const f = Math.cos(p.flip);                      // tumbling: the piece turns edge-on and back
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, f);
      ctx.fillStyle = p.c;
      if (p.kind === 'dot') { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, Math.min(p.w, p.h) * .18); ctx.fill(); }
      // light catching the face as it turns
      ctx.globalAlpha = Math.max(0, f) * .35; ctx.fillStyle = '#fff';
      if (p.kind !== 'dot') ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * .35);
      ctx.restore();
    });
    parts = parts.filter(p => p.y < H + 80);
    raf = parts.length ? requestAnimationFrame(tick) : 0;
  };
  const yes = () => {
    close(true);
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    if (!reduced) { burst(canvas.width, canvas.height); raf = requestAnimationFrame(tick); }
    timers.push(setTimeout(() => { reveal.classList.add('on'); reveal.setAttribute('aria-hidden', 'false'); dark(true); }, reduced ? 0 : 700));
    timers.push(setTimeout(() => { reveal.classList.add('show'); $('.ct-mail a', reveal).focus({ preventScroll: true }); }, reduced ? 0 : 1500));
  };
  const dark = on => { $('.views').classList.toggle('ct-dark', on); document.documentElement.classList.toggle('ct-dark', on); };
  const close = keepCanvas => {
    timers.forEach(clearTimeout); timers = [];
    reveal.classList.remove('on', 'show'); reveal.setAttribute('aria-hidden', 'true'); dark(false);
    if (!keepCanvas) { cancelAnimationFrame(raf); raf = 0; parts = []; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };
  $('.ct-back').addEventListener('click', () => close());
  // Esc closes the details first, before it closes the page
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && reveal.classList.contains('on')) { e.stopImmediatePropagation(); close(); }
  }, true);
  // leaving the Contact page resets it
  new MutationObserver(() => { if (!$('#contact').classList.contains('active')) { close(); cancelAnimationFrame(raf2); raf2 = 0; vel = { x: 0, y: 0 }; move(0, 0); } })
    .observe($('#contact'), { attributes: true, attributeFilter: ['class'] });
})();

/* ---------- Colour swatches (and anything with data-copy): click to copy, with a small toast ---------- */
(() => {
  const toast = $('.toast');
  let t = 0;
  const say = msg => {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(t); t = setTimeout(() => toast.classList.remove('show'), 1600);
  };
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-hex], [data-copy]');
    if (!b) return;
    const text = b.dataset.hex || b.dataset.copy;
    try { await navigator.clipboard.writeText(text); say(`Copied ${text}`); }
    catch { say(text); }
  });
})();
