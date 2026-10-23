/* Opening choreography. This animates rendering of saved grids, not model inference. */
(() => {
  'use strict';
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = value => Math.max(0, Math.min(1, value));
  const TIMING = { title: 1900, gallery: 1280, stagger: 180, specimen: window.PixelGridTransition.duration };

  window.startHeroIntro = (dataPromise, loadRaster) => {
    const cards = [...document.querySelectorAll('.specimen')];
    const title = document.querySelector('.hero h1');
    const replay = document.querySelector('#replay-rendering');
    replay.hidden = false;
    let frame = 0, animations = [], specimens = [], running = false, run = 0;
    let startedAt = 0, revealAt = 0;
    let pendingAssets = false;
    let viewportWidth = innerWidth;

    function finish() {
      run++;
      running = false;
      pendingAssets = false;
      cancelAnimationFrame(frame);
      animations.forEach(animation => animation.cancel());
      animations = [];
      cards.forEach(card => {
        card.querySelector('.specimen-rendering')?.remove();
        card.classList.remove('is-rendering', 'awaiting-render');
        card.removeAttribute('data-render-progress');
      });
      specimens = [];
      root.classList.remove('intro-pending', 'intro-running');
      root.dataset.intro = 'complete';
      replay.disabled = motion.matches;
    }

    document.addEventListener('languagechange', finish);

    function animate(element, keyframes, options) {
      animations.push(element.animate(keyframes, { fill: 'both', ...options }));
    }

    function prepare(card, raster) {
      const effect=window.PixelGridTransition.create(raster);
      effect.canvas.className='specimen-rendering';
      card.querySelector('.specimen-image').append(effect.canvas);
      card.classList.add('is-rendering');
      return {...effect,card,done:false};
    }

    function paint(specimen, elapsed) {
      window.PixelGridTransition.paint(specimen,elapsed);
      specimen.card.dataset.renderProgress=String(clamp(elapsed/TIMING.specimen));
    }

    function tick(now) {
      if (!running) return;
      const elapsed = now - startedAt;
      specimens.forEach((specimen, index) => {
        if (!specimen || specimen.done) return;
        const local = elapsed - revealAt - index * TIMING.stagger;
        if (local >= TIMING.specimen) {
          specimen.done = true;
          specimen.canvas.remove();
          specimen.card.classList.remove('is-rendering');
          specimen.card.dataset.renderProgress = '1';
        } else {
          paint(specimen, local);
        }
      });
      const end = revealAt + (cards.length - 1) * TIMING.stagger + TIMING.specimen;
      if ((!pendingAssets && elapsed >= end) || (pendingAssets && elapsed >= 6000)) finish();
      else frame = requestAnimationFrame(tick);
    }

    let assetPromise;
    function loadAssets() {
      assetPromise ??= dataPromise.then(data => Promise.allSettled(cards.map(card => {
        const sample = data.samples.find(item => item.id === card.dataset.sample);
        return loadRaster(sample.path);
      }))).catch(() => []);
      return assetPromise;
    }

    async function play(intro) {
      finish();
      if (motion.matches) { root.dataset.intro = 'skipped'; return; }
      const current = ++run;
      running = true;
      pendingAssets = true;
      cards.forEach(card => card.classList.add('awaiting-render'));
      root.dataset.intro = intro ? 'preparing' : 'replaying';
      replay.disabled = true;
      const assets = loadAssets();
      if (intro) {
        root.classList.add('intro-pending');
        // Keep the first title frame centered after the local fonts settle.
        await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 400))]);
        if (current !== run) return;
      }
      startedAt = performance.now();
      revealAt = intro ? TIMING.gallery : 0;
      root.dataset.intro = intro ? 'running' : 'replaying';
      if (intro) {
        root.classList.replace('intro-pending', 'intro-running');
        const bounds = title.getBoundingClientRect();
        const offset = innerHeight / 2 - (bounds.top + bounds.height / 2);
        animate(title, [
          { opacity: 0, transform: `translateY(${offset}px)`, offset: 0 },
          { opacity: 1, transform: `translateY(${offset}px)`, offset: .18 },
          { opacity: 1, transform: `translateY(${offset}px)`, offset: .36, easing: 'cubic-bezier(.22,.72,.16,1)' },
          { opacity: 1, transform: 'translateY(0)', offset: 1 }
        ], { duration: TIMING.title });
        for (const [selector, delay] of [['.site-header', 1080], ['.hero-deck', 1440], ['.hero-figure', 1160], ['.article-layout', 1880], ['.mobile-contents', 1880], ['.site-footer', 1880]]) {
          animate(document.querySelector(selector), [{ opacity: 0 }, { opacity: 1 }], { duration: 620, delay, easing: 'ease-out' });
        }
        cards.forEach((card, index) => {
          animate(card.querySelector('.specimen-label'), [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600, delay: revealAt + index * TIMING.stagger + 500 });
        });
        animate(document.querySelector('.hero-figure figcaption'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 2100 });
      }
      // Begin the title independently of data requests; missing data keep their PNG fallback.
      assets.then(results => {
        if (current !== run) return;
        const elapsed = performance.now() - startedAt;
        pendingAssets = false;
        const available = results.some(result => result.status === 'fulfilled');
        if (!available) {
          cards.forEach(card => card.classList.remove('awaiting-render'));
          if (!intro) finish();
          return;
        }
        // Start when real data arrive, even if that is after the title has risen.
        // Reserve the image area meanwhile, so there is no final-image-to-numbers flash.
        revealAt = Math.max(revealAt, elapsed);
        specimens = results.map((result, index) => result.status === 'fulfilled' ? prepare(cards[index], result.value) : null);
        cards.forEach(card => card.classList.remove('awaiting-render'));
      });
      frame = requestAnimationFrame(tick);
    }

    replay.addEventListener('click', () => play(false));
    // Scrolling stays native and independent of the rendering timeline.
    const skip = () => { if (running) finish(); };
    window.addEventListener('keydown', event => {
      if (['Tab', 'Escape'].includes(event.key)) skip();
    });
    window.addEventListener('resize', () => {
      // Browser chrome can change viewport height during a mobile scroll.
      // Only a width change requires restoring the responsive static layout.
      if (innerWidth !== viewportWidth) skip();
      viewportWidth = innerWidth;
    });
    window.addEventListener('pagehide', skip);
    window.addEventListener('beforeprint', skip);
    document.addEventListener('visibilitychange', () => { if (document.hidden) skip(); });
    motion.addEventListener('change', () => { finish(); replay.disabled = motion.matches; });
    const shouldOpen = root.classList.contains('intro-pending') && scrollY < 8;
    if (shouldOpen) play(true);
    else { finish(); root.dataset.intro = 'skipped'; }
  };
})();
