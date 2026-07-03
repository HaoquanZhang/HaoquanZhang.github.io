// Main JavaScript file for the website

// Global variables
let authorLinks = {};
let allPublications = [];
let currentPublicationLayoutMode = 'desktop';
let researchResizeRafId = null;

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
  setResearchFilter(getActiveResearchFilter());
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
  const centerX = buttonRect.left + buttonRect.width / 2 - filterRect.left;
  indicator.style.left = centerX + 'px';
}

function setResearchFilter(filter) {
  const normalized = filter || 'selected';
  const filteredPublications = allPublications.filter(function(publication) {
    return publicationMatchesFilter(publication, normalized);
  });

  renderPublicationList(filteredPublications);

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

  setResearchFilter(savedFilter);
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
