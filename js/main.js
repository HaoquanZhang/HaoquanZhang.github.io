// Main JavaScript file for the website

// Global variables
let authorLinks = {};
let allPublications = [];
let currentPublicationLayoutMode = 'desktop';
let researchResizeRafId = null;
let researchTransitionTimer = null;
let navScrollRafId = null;
const showResearchLineDescriptions = false;
let placeholderTitleTimer = null;
let activePlaceholderTitle = null;

const navAnchorOffset = {
  desktop: 40,
  mobile: 76
};

const placeholderTitleIdeas = [
  'Training Dynamics',
  'Physics of AI',
  'Agentic Vision',
  'Pretraining Mechanisms',
  'Reward Design',
  'Outcome Supervision',
  'Emergent Tool Use',
  'Visual Reasoning',
  'Interactive Learning',
  'World Models',
  'Representation Learning',
  'Self-Improvement',
  'Generalist Agents',
  'Test-Time Learning',
  'Scaling Laws',
  'Embodied Intelligence',
  'Generative Models',
  'Machine Creativity',
  'Autonomous Discovery',
  'Open-Ended Learning'
];

const researchLineContent = {
  selected: {
    description: 'A selection of projects exploring how intelligent systems perceive, reason, create, and interact with the visual world.'
  },
  'agentic-vision': {
    description: 'We believe the future of AI lies in agents that learn through interaction rather than predefined workflows. Guided by the Bitter Lesson, we supervise only outcomes instead of prescribing tools or execution processes, allowing models to write code, invent reusable tool primitives, and discover their own strategies autonomously.\n\nWe explore this paradigm in visual intelligence by building visual agents that interact with vision-centric environments. Our research spans benchmarking, reinforcement learning, and reasoning over both images and videos.'
  },
  'visual-generation': {
    description: 'We study generative models that turn ideas into expressive visual content with greater quality, control, and consistency.'
  }
};

function updateSiteNav() {
  const nav = document.getElementById('site-nav');
  if (nav) {
    nav.classList.toggle('is-floating', window.scrollY > 20);
  }
}

function handleSiteNavScroll() {
  if (navScrollRafId !== null) {
    return;
  }

  navScrollRafId = requestAnimationFrame(function() {
    navScrollRafId = null;
    updateSiteNav();
  });
}

function initSiteNav() {
  const nav = document.getElementById('site-nav');
  updateSiteNav();
  window.addEventListener('scroll', handleSiteNavScroll, { passive: true });

  if (!nav) {
    return;
  }

  nav.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(event) {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) {
        return;
      }

      event.preventDefault();
      const layout = window.innerWidth <= 600 ? 'mobile' : 'desktop';
      const targetTop = target.getBoundingClientRect().top
        + window.scrollY
        - navAnchorOffset[layout];
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
      history.pushState(null, '', link.getAttribute('href'));
    });
  });
}

function getPublicationLayoutMode() {
  return window.innerWidth <= 600 ? 'mobile' : 'desktop';
}

function getActiveResearchFilter() {
  const activeButton = document.querySelector('.research-filter__btn.is-active');
  return activeButton ? activeButton.dataset.filter : 'selected';
}

function syncPublicationLayoutMode() {
  const nextMode = getPublicationLayoutMode();
  if (nextMode === currentPublicationLayoutMode) {
    return false;
  }

  currentPublicationLayoutMode = nextMode;
  setResearchFilter(getActiveResearchFilter(), true);
  return true;
}

function handleResearchResize() {
  if (researchResizeRafId !== null) {
    return;
  }

  researchResizeRafId = requestAnimationFrame(function() {
    researchResizeRafId = null;
    const layoutChanged = syncPublicationLayoutMode();
    if (!layoutChanged) {
      updateResearchFilterIndicator();
      document.querySelectorAll('.is-pyvision-active').forEach(sizePyvisionPreview);
    }
  });
}

// Function to load author links
async function loadAuthorLinks() {
  try {
    const response = await fetch('data/authors.json');
    authorLinks = await response.json();
  } catch (error) {
    console.error('Error loading author links:', error);
  }
}

function publicationMatchesFilter(publication, filter) {
  if (!publication.show) {
    return false;
  }
  const topics = publication.topics || [];
  return topics.includes(filter);
}

function renderPublicationList(publications) {
  const container = document.getElementById('publications-container');
  if (!container) {
    return;
  }

  stopPlaceholderTitleCycle(false);
  container.innerHTML = publications
    .map(function(publication) {
      return createPublicationHTML(publication);
    })
    .join('');
  initPlaceholderTitleEffects(container);
  initPyvisionPreviews(container);
}

function stopPlaceholderTitleCycle(restoreTitle = true) {
  if (placeholderTitleTimer !== null) {
    clearTimeout(placeholderTitleTimer);
    placeholderTitleTimer = null;
  }

  const title = activePlaceholderTitle;
  activePlaceholderTitle = null;
  if (!title) {
    return;
  }

  if (restoreTitle) {
    title.textContent = title.dataset.originalTitle;
  }
}

function startPlaceholderTitleCycle(title) {
  stopPlaceholderTitleCycle(false);
  activePlaceholderTitle = title;
  let ideaIndex = 0;

  function showNextIdea() {
    if (activePlaceholderTitle !== title) {
      return;
    }

    title.textContent = placeholderTitleIdeas[ideaIndex];
    ideaIndex = (ideaIndex + 1) % placeholderTitleIdeas.length;
    placeholderTitleTimer = setTimeout(showNextIdea, 90);
  }

  showNextIdea();
}

function initPlaceholderTitleEffects(container) {
  container.querySelectorAll('.paper-container').forEach(function(publication) {
    const title = publication.querySelector('.papertitle--placeholder');
    if (!title) {
      return;
    }

    title.dataset.originalTitle = title.textContent;
    publication.addEventListener('mouseenter', function() {
      startPlaceholderTitleCycle(title);
    });
    publication.addEventListener('mouseleave', function() {
      stopPlaceholderTitleCycle(true);
    });
  });
}

function updateResearchFilterIndicator() {
  const filter = document.querySelector('.research-filter');
  if (!filter || window.innerWidth <= 600) {
    return;
  }

  const indicator = filter.querySelector('.research-filter__indicator');
  const activeButton = filter.querySelector('.research-filter__btn.is-active');
  if (!indicator || !activeButton) {
    return;
  }

  const filterRect = filter.getBoundingClientRect();
  const buttonRect = activeButton.getBoundingClientRect();
  indicator.style.left = buttonRect.left - filterRect.left + 'px';
  indicator.style.width = buttonRect.width + 'px';
}

function updateResearchContent(normalized, filteredPublications) {
  const container = document.getElementById('publications-container');
  const lineContent = researchLineContent[normalized] || researchLineContent.selected;
  const intro = document.querySelector('.research-line-intro');
  const introDescription = document.getElementById('research-line-description');

  if (intro && introDescription) {
    const showIntro = showResearchLineDescriptions && normalized !== 'selected';
    introDescription.textContent = lineContent.description;
    intro.classList.toggle('is-visible', showIntro);
    intro.setAttribute('aria-hidden', showIntro ? 'false' : 'true');

    if (showIntro) {
      introDescription.classList.remove('is-entering');
      void introDescription.offsetWidth;
      introDescription.classList.add('is-entering');
    }
  }

  renderPublicationList(filteredPublications);

  if (container) {
    void container.offsetWidth;
    container.classList.remove('is-leaving');
  }
  if (intro) {
    intro.classList.remove('is-leaving');
  }
}

function setResearchFilter(filter, skipTransition = false) {
  const normalized = filter || 'selected';
  const filteredPublications = allPublications.filter(function(publication) {
    return publicationMatchesFilter(publication, normalized);
  });

  const container = document.getElementById('publications-container');
  const intro = document.querySelector('.research-line-intro');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldFadeOut = !skipTransition
    && !prefersReducedMotion
    && container
    && container.children.length > 0;

  document.querySelectorAll('.research-filter__btn').forEach(function(button) {
    const isActive = button.dataset.filter === normalized;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  requestAnimationFrame(updateResearchFilterIndicator);

  try {
    localStorage.setItem('research-filter', normalized);
  } catch (error) {
    // Ignore storage errors in private browsing.
  }

  if (researchTransitionTimer !== null) {
    clearTimeout(researchTransitionTimer);
    researchTransitionTimer = null;
  }

  if (!shouldFadeOut) {
    updateResearchContent(normalized, filteredPublications);
    return;
  }

  container.classList.add('is-leaving');
  if (intro && intro.classList.contains('is-visible')) {
    intro.classList.add('is-leaving');
  }

  researchTransitionTimer = setTimeout(function() {
    researchTransitionTimer = null;
    updateResearchContent(normalized, filteredPublications);
  }, 160);
}

function initResearchFilter() {
  const validFilters = Array.from(document.querySelectorAll('.research-filter__btn'))
    .map(function(button) {
      return button.dataset.filter;
    });

  let savedFilter = 'selected';
  try {
    const stored = localStorage.getItem('research-filter');
    if (stored && validFilters.includes(stored)) {
      savedFilter = stored;
    }
  } catch (error) {
    // Ignore storage errors in private browsing.
  }

  document.querySelectorAll('.research-filter__btn').forEach(function(button) {
    button.addEventListener('click', function() {
      setResearchFilter(button.dataset.filter);
    });
  });

  currentPublicationLayoutMode = getPublicationLayoutMode();
  window.addEventListener('resize', handleResearchResize);

  setResearchFilter(savedFilter, true);
}

// Function to render publications from JSON data
async function renderPublications() {
  try {
    await loadAuthorLinks();
    const response = await fetch('data/publications.json?v=20261106-x-post', { cache: 'no-cache' });
    allPublications = await response.json();
    initResearchFilter();
  } catch (error) {
    console.error('Error loading publications:', error);
  }
}

// Primary link for mobile paper cards: leaderboard → project → paper
function getPublicationCardLink(links) {
  if (!links) {
    return '';
  }
  return links.leaderboard || links.project || links.paper || '';
}

// Primary link for desktop title: project → paper
function getPublicationTitleLink(links) {
  if (!links) {
    return '';
  }
  return links.project || links.paper || '';
}

function createPublicationMedia(pub, className) {
  if (!pub.image) {
    return '';
  }

  const alt = pub.imageAlt || pub.title;
  if (pub.hoverEffect === 'color-story') {
    return `<button type="button" class="${className} pyvision-preview" aria-label="Play circle comparison" aria-expanded="false" aria-controls="${pub.id}-demo">
      <svg class="pyvision-scene" viewBox="0 0 640 640" role="img" aria-label="${alt}" focusable="false">
        <use class="pyvision-context" href="${pub.image}#pyvision-context"/>
        <use class="pyvision-targets" href="${pub.image}#pyvision-targets"/>
      </svg>
      ${createPyvisionStory(pub)}
    </button>`;
  }

  if (pub.hoverEffect === 'layers') {
    const layers = ['base', 'bike', 'rider'];
    return `<div class="${className} sgp-preview">
      <img class="sgp-preview__flat" src="${pub.image}" alt="${alt}">
      <span class="sgp-scene" aria-hidden="true">
        ${layers.map((layer, index) => `<span class="sgp-plane" style="--layer: ${index - 1}">
          <svg viewBox="0 0 400 400" focusable="false">
            <rect class="sgp-plane__guide" x="1" y="1" width="398" height="398" rx="3"/>
            <use href="${pub.image}#sgp-${layer}"/>
          </svg>
        </span>`).join('')}
      </span>
    </div>`;
  }

  return `<div class="${className}${pub.hoverImage ? ' paper-preview' : ''}">
    <img src="${pub.image}" alt="${alt}">
    ${pub.hoverImage ? `<img class="paper-preview__overlay" src="${pub.hoverImage}" alt="" aria-hidden="true">` : ''}
  </div>`;
}

function createPublicationHTMLMobile(pub) {
  const cardLink = getPublicationCardLink(pub.links);
  const hasDemo = pub.hoverEffect === 'color-story';
  const tag = cardLink && !hasDemo ? 'a' : 'div';
  const hrefAttr = cardLink
    ? ` href="${cardLink}" target="_blank" rel="noopener noreferrer"`
    : '';
  const staticClass = cardLink ? '' : ' paper-card--static';

  const mediaHTML = createPublicationMedia(pub, 'paper-card__media');

  return `
        <${tag}${hasDemo ? '' : hrefAttr} class="paper-card fade-in delay-2${staticClass}${pub.image ? '' : ' paper-card--no-media'}${hasDemo ? ' paper--pyvision' : ''}">
          ${mediaHTML}
          <${hasDemo ? `a${hrefAttr}` : 'div'} class="paper-card__body">
            <p class="paper-card__title${pub.isPlaceholder ? ' paper-card__title--placeholder' : ''}">${pub.title}</p>
            <p class="paper-card__meta">${pub.venue}</p>
          </${hasDemo ? 'a' : 'div'}>
        </${tag}>`;
}

// Function to create HTML for a single publication (desktop layout)
function createPublicationHTMLDesktop(pub) {
  // Generate authors string with automatic links
  let authorsHTML = '';
  pub.authors.forEach((author, index) => {
    let authorName = author.name;
    
    // Check if author has a homepage link
    const authorLink = authorLinks[authorName];
    if (authorLink && authorLink !== '') {
      authorName = `<a href="${authorLink}" target="_blank">${authorName}</a>`;
    }
    
    if (author.isHighlight) {
      authorName = `<u><strong>${authorName}</strong></u>`;
    }
    
    if (author.isCoFirst) {
      authorName += '*';
    }
    
    authorsHTML += authorName;
    
    if (index < pub.authors.length - 1) {
      authorsHTML += ',\n              ';
    }
  });
  
  // Collect links with display text, then sort by text length descending
  let linkItems = [];
  for (const [linkType, url] of Object.entries(pub.links)) {
    if (url && url !== '') {
      let linkText = '';
      switch (linkType) {
        case 'paper': linkText = 'Paper'; break;
        case 'code': linkText = 'Code'; break;
        case 'project': linkText = 'Project'; break;
        case 'demo': linkText = 'Demo'; break;
        case 'benchmark': linkText = 'Benchmark'; break;
        default: linkText = linkType.charAt(0).toUpperCase() + linkType.slice(1);
      }
      linkItems.push({ url, text: pub.linkLabels?.[linkType] || linkText });
    }
  }
  if (pub.misc && pub.misc.text && pub.misc.link && pub.misc.link !== '') {
    linkItems.push({ url: pub.misc.link, text: pub.misc.text, isMisc: true });
  }
  linkItems.sort((a, b) => b.text.length - a.text.length);

  let sidebarLinksHTML = linkItems.map(item => {
    const cls = item.isMisc ? 'button misc-button' : 'button';
    const target = item.isMisc ? ' target="_blank"' : '';
    return `<a href="${item.url}" class="${cls}"${target}>${item.text}</a>`;
  }).join('\n            ');
  
  const venueNoBreak = pub.venue.replace(/\s/g, '&nbsp;');
  let venueText = venueNoBreak;

  // Keep Spotlight on a new line for desktop.
  if (/neurips/i.test(pub.venue) && /spotlight/i.test(pub.venue)) {
    venueText = venueNoBreak
      .replace(/&nbsp;\(Spotlight\)/i, '<br>(Spotlight)')
      .replace(/&nbsp;Spotlight/i, '<br>Spotlight');
  } else {
    venueText = venueNoBreak.replace(/&nbsp;(\([^)]+\))/, '<br>$1');
  }

  const primaryTitleLink = getPublicationTitleLink(pub.links);
  const titleClass = `papertitle${pub.isPlaceholder ? ' papertitle--placeholder' : ''}`;
  const titleHTML = primaryTitleLink
    ? `<a href="${primaryTitleLink}" class="${titleClass}" target="_blank" rel="noopener noreferrer">${pub.title}</a>`
    : `<span class="${titleClass}">${pub.title}</span>`;

  const highlightsHTML = createHighlightsHTML(pub.highlights);
  const imageHTML = createPublicationMedia(pub, 'paper-image');

  return `
        <div class="paper-container fade-in delay-2${pub.image ? '' : ' paper-container--no-image'}${pub.hoverEffect === 'color-story' ? ' paper--pyvision' : ''}">
          <div class="paper-sidebar">
            <span class="${pub.venueType}"><strong>${venueText}</strong></span>
            ${sidebarLinksHTML}
          </div>
          <div class="paper-main">
            ${titleHTML}
            <p class="paper-authors">${authorsHTML}</p>
          </div>${imageHTML}${highlightsHTML}
        </div>`;
}

function createPyvisionStory(pub) {
  const [left, right] = pub.colorDemo.counts;
  const rgb = pub.colorDemo.rgb.join(', ');
  // Exact RGB matches in the source PNG, excluding antialiased edge pixels.
  return `<span class="pyvision-story" id="${pub.id}-demo" aria-hidden="true" data-left-pixels="${left}" data-right-pixels="${right}">
    <span class="pyvision-question">Which orange circle is larger?</span>
    <code class="pyvision-code"><span>rgb = <span class="pyvision-color">[${rgb}]</span></span><span>mask = (img == rgb).all(-1)</span><span class="pyvision-color"><i class="pyvision-swatch" aria-hidden="true"></i>#EA5517</span></code>
    <svg class="pyvision-measure" viewBox="0 0 640 340" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <use class="pyvision-context" href="${pub.image}#pyvision-context" transform="translate(0 -156)"/>
      <g class="pyvision-tracks">
        <rect x="72" y="32" width="536" height="115" rx="12"/>
        <rect x="72" y="194" width="536" height="115" rx="12"/>
      </g>
      <rect class="pyvision-region" data-region="left" x="103.5" y="135.5" width="57" height="57" rx="28.5"/>
      <rect class="pyvision-region" data-region="right" x="361" y="75" width="178" height="178" rx="89"/>
    </svg>
    <span class="pyvision-count-heading">Orange pixels</span>
    <span class="pyvision-bar-labels">
      <span class="pyvision-bar-label"><span class="pyvision-side">L</span><span class="pyvision-pixels" data-count="left">0 px</span></span>
      <span class="pyvision-bar-label"><span class="pyvision-side">R</span><span class="pyvision-pixels pyvision-pixels--right" data-count="right">0 px</span></span>
    </span>
    <span class="pyvision-answer">Right is larger <span>· ${ (right / left).toFixed(1) }×</span></span>
  </span>`;
}

function sizePyvisionPreview(card) {
  const button = card.querySelector('.pyvision-preview');
  const bounds = button.getBoundingClientRect();
  const width = Math.max(bounds.width, Math.min(320, window.innerWidth - bounds.left - 16));
  button.style.setProperty('--pyvision-width', `${width}px`);
  card.classList.toggle('pyvision-wide', width >= 300);
}

function initPyvisionPreviews(container) {
  container.querySelectorAll('.paper--pyvision').forEach(function(card) {
    const button = card.querySelector('.pyvision-preview');
    const story = card.querySelector('.pyvision-story');
    const contexts = card.querySelectorAll('.pyvision-context');
    const tracks = story.querySelector('.pyvision-tracks');
    const labels = story.querySelector('.pyvision-bar-labels');
    const counts = [Number(story.dataset.leftPixels), Number(story.dataset.rightPixels)];
    const regions = ['left', 'right'].map(side => story.querySelector(`[data-region="${side}"]`));
    const numbers = ['left', 'right'].map(side => story.querySelector(`[data-count="${side}"]`));
    const initial = [[103.5, 135.5, 57, 57, 28.5], [361, 75, 178, 178, 89]];
    const final = [[72, 32, 536 * counts[0] / counts[1], 115, 12], [72, 194, 536, 115, 12]];
    const attributes = ['x', 'y', 'width', 'height', 'rx'];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = null;
    let active = false;
    let pinned = false;
    let hovered = false;

    function progress(time, start, duration) {
      const t = Math.max(0, Math.min(1, (time - start) / duration));
      return t * t * (3 - 2 * t);
    }

    function draw(time) {
      card.dataset.pyvisionStage = time < 1200 ? '1' : time < 3600 ? '2' : time < 5600 ? '3' : '4';
      const isolated = progress(time, 2200, 900);
      contexts.forEach(context => { context.style.opacity = 1 - isolated; });
      const morph = progress(time, 3600, 1500);
      tracks.style.opacity = progress(time, 3600, 700);
      labels.style.opacity = progress(time, 4100, 600);
      regions.forEach((region, index) => {
        attributes.forEach((attribute, i) => {
          region.setAttribute(attribute, initial[index][i] + (final[index][i] - initial[index][i]) * morph);
        });
        numbers[index].textContent = `${Math.round(counts[index] * morph).toLocaleString('en-US')} px`;
      });
    }

    function start() {
      if (active) return;
      active = true;
      sizePyvisionPreview(card);
      card.classList.add('is-pyvision-active');
      button.setAttribute('aria-expanded', 'true');
      story.setAttribute('aria-hidden', 'false');
      const started = performance.now();
      function tick(now) {
        if (!active || !card.isConnected) return;
        const time = reducedMotion.matches ? 6200 : now - started;
        draw(time);
        frame = time < 6200 ? requestAnimationFrame(tick) : null;
      }
      tick(started);
    }

    function stop() {
      active = false;
      pinned = false;
      cancelAnimationFrame(frame);
      frame = null;
      card.classList.remove('is-pyvision-active');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Play circle comparison');
      story.setAttribute('aria-hidden', 'true');
      draw(0);
    }

    card.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hovered = true;
      start();
    });
    card.addEventListener('pointerleave', () => {
      hovered = false;
      if (!pinned && !card.contains(document.activeElement)) stop();
    });
    card.addEventListener('focusin', start);
    card.addEventListener('focusout', event => {
      if (!pinned && !hovered && !card.contains(event.relatedTarget)) stop();
    });
    button.addEventListener('click', () => {
      if (pinned) {
        stop();
      } else {
        pinned = true;
        button.setAttribute('aria-label', 'Close circle comparison');
        start();
      }
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Escape') stop();
    });
    draw(0);
  });
}

function createHighlightsHTML(highlights) {
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return '';
  }

  const items = highlights
    .map(function(item) {
      return `<li>${item}</li>`;
    })
    .join('\n              ');

  return `
          <div class="paper-aside">
            <ul class="paper-highlights">
              ${items}
            </ul>
          </div>`;
}

function createPublicationHTML(pub) {
  if (window.innerWidth <= 600) {
    return createPublicationHTMLMobile(pub);
  }
  return createPublicationHTMLDesktop(pub);
}

initSiteNav();

function initNews() {
  const container = document.getElementById('news-items');
  if (!container) {
    return;
  }

  const olderItems = Array.from(container.querySelectorAll('.news-item')).slice(4);
  if (olderItems.length === 0) {
    return;
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'news-toggle';
  toggle.setAttribute('aria-controls', container.id);
  let expanded = false;

  function updateNews() {
    olderItems.forEach(function(item) {
      item.hidden = !expanded;
    });
    toggle.textContent = expanded ? 'Show less' : 'Show more';
    toggle.setAttribute('aria-expanded', String(expanded));
  }

  toggle.addEventListener('click', function() {
    expanded = !expanded;
    updateNews();
  });
  updateNews();
  container.after(toggle);
}

// Run when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function() {
    initNews();
    renderPublications();
  });
} else {
  // DOM already loaded, run now
  initNews();
  renderPublications();
}
