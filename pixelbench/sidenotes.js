/* Margin notes on wide screens; the same linked notes at the end on narrow screens. */
(() => {
  'use strict';
  const wide = matchMedia('(min-width: 1280px)');
  const notes = [...document.querySelectorAll('.sidenote')];
  const endnotes = document.querySelector('#article-notes');
  const homes = new Map(notes.map(note => [note, {
    parent: note.parentElement,
    language: note.closest('[data-copy]').dataset.copy
  }]));
  document.documentElement.classList.add('sidenotes-ready');
  let frame = 0;
  const visible = el => el.getClientRects().length > 0;

  function layout() {
    frame = 0;
    document.querySelectorAll('.reading-block').forEach(block => {
      block.style.paddingBottom = '';
      const active = [...block.querySelectorAll('.sidenote')].filter(visible);
      if (!wide.matches) {
        active.forEach(note => { note.style.top = ''; });
        return;
      }
      const top = block.getBoundingClientRect().top;
      const height = block.getBoundingClientRect().height;
      const gap = 18;
      let bottom = 0;
      const placements = active.map(note => {
        const ref = document.getElementById(note.dataset.noteRef);
        const y = Math.max(ref.getBoundingClientRect().top - top, bottom);
        const noteHeight = note.getBoundingClientRect().height;
        bottom = y + noteHeight + gap;
        return {note, y, height:noteHeight};
      });
      // Fit back from the next figure before adding space to the article.
      // This lets long notes rise into unused margin above their references,
      // preserving note order and the gap between adjacent notes.
      const packedHeight = placements.reduce((sum, item) => sum + item.height, 0)
        + Math.max(0, placements.length - 1) * gap;
      const capacity = Math.max(height, packedHeight);
      bottom = capacity;
      for (let i = placements.length - 1; i >= 0; i--) {
        const item = placements[i];
        item.y = Math.min(item.y, bottom - item.height);
        item.note.style.top = `${item.y}px`;
        bottom = item.y - gap;
      }
      // Only expand if the notes cannot fit even after using the space above.
      if (packedHeight > height) block.style.paddingBottom = `${Math.ceil(packedHeight - height)}px`;
    });
    document.dispatchEvent(new Event('sidenoteslayout'));
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(layout);
  }
  function sync() {
    endnotes.hidden = wide.matches;
    const ordered = wide.matches ? notes : [...notes].sort((a, b) =>
      Number(a.querySelector('.sidenote-number').textContent) - Number(b.querySelector('.sidenote-number').textContent));
    ordered.forEach(note => {
      const home = homes.get(note);
      const parent = wide.matches ? home.parent : endnotes.querySelector(`[data-copy="${home.language}"]`);
      if (note.parentElement !== parent) parent.append(note);
      if (!wide.matches) note.style.top = '';
      note.querySelector('details').open = true;
    });
    document.querySelectorAll('a.footnote-ref').forEach(ref => ref.removeAttribute('aria-expanded'));
    layout();
  }
  function resolveHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target?.classList.contains('sidenote')) return;
    requestAnimationFrame(() => target.scrollIntoView({block:wide.matches?'nearest':'start', behavior:'instant'}));
  }
  document.querySelectorAll('a.footnote-ref').forEach(ref => ref.addEventListener('click', event => {
    const note = document.getElementById(ref.getAttribute('aria-controls'));
    if (!note) return;
    event.preventDefault();
    try { history.pushState(null, '', ref.getAttribute('href')); } catch {}
    note.focus({preventScroll:true});
    if (!wide.matches) note.scrollIntoView({block:'start',behavior:'instant'});
  }));
  document.addEventListener('languagechange', () => {sync();requestAnimationFrame(resolveHash);});
  document.addEventListener('specimenchange', schedule);
  // Reflow for edited text, loaded media, or other content-driven size changes.
  const observer = new ResizeObserver(schedule);
  document.querySelectorAll('.reading-block, .sidenote').forEach(el => observer.observe(el));
  window.addEventListener('resize', schedule);
  wide.addEventListener('change', sync);
  window.addEventListener('hashchange', resolveHash);
  window.addEventListener('load', () => { layout(); resolveHash(); });
  document.fonts.ready.then(() => { layout(); resolveHash(); });
  sync();
  resolveHash();
})();
