// Main JavaScript file for the website

// Global variables
let authorLinks = {};
let allPublications = [];
let currentPublicationLayoutMode = 'desktop';
let researchResizeRafId = null;
let researchTransitionTimer = null;
const showResearchLineDescriptions = false;

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

  container.innerHTML = publications
    .map(function(publication) {
      return createPublicationHTML(publication);
    })
    .join('');
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
    const response = await fetch('data/publications.json');
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

function createPublicationHTMLMobile(pub) {
  const cardLink = getPublicationCardLink(pub.links);
  const tag = cardLink ? 'a' : 'div';
  const hrefAttr = cardLink
    ? ` href="${cardLink}" target="_blank" rel="noopener noreferrer"`
    : '';
  const staticClass = cardLink ? '' : ' paper-card--static';

  const mediaHTML = pub.image
    ? `<div class="paper-card__media">
            <img src="${pub.image}" alt="${pub.title}">
          </div>`
    : '';

  return `
        <${tag}${hrefAttr} class="paper-card fade-in delay-2${staticClass}${pub.image ? '' : ' paper-card--no-media'}">
          ${mediaHTML}
          <div class="paper-card__body">
            <p class="paper-card__title">${pub.title}</p>
            <p class="paper-card__meta">${pub.venue}</p>
          </div>
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
      linkItems.push({ url, text: linkText });
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
  const titleHTML = primaryTitleLink
    ? `<a href="${primaryTitleLink}" class="papertitle" target="_blank" rel="noopener noreferrer">${pub.title}</a>`
    : `<span class="papertitle">${pub.title}</span>`;

  const highlightsHTML = createHighlightsHTML(pub.highlights);
  const imageHTML = pub.image
    ? `<div class="paper-image">
            <img src='${pub.image}' alt="${pub.id}">
          </div>`
    : '';

  return `
        <div class="paper-container fade-in delay-2${pub.image ? '' : ' paper-container--no-image'}">
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

// Run when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function() {
    renderPublications();
  });
} else {
  // DOM already loaded, run now
  renderPublications();
}
