// Main JavaScript file for the website

// Read navigation height safely because mobile nav can be removed.
function getVisibleNavbarHeight() {
  const desktopNav = document.querySelector('.desktop-component ul');
  const mobileNav = document.querySelector('.mobile-component ul');

  if (window.innerWidth < 768) {
    return mobileNav ? mobileNav.offsetHeight : 0;
  }
  return desktopNav ? desktopNav.offsetHeight : 0;
}

// Add click event listeners to navigation links.
document.querySelectorAll('.mobile-component ul li a, .desktop-component ul li a').forEach(function(anchor) {
  anchor.addEventListener('click', function(event) {
    event.preventDefault(); // Prevent the default navigation behavior

    var targetId = this.getAttribute('href'); // Get the target section's ID from the link's href
    var targetElement = document.querySelector(targetId); // Find the target element using its ID
    if (!targetElement) {
      return;
    }
    var targetOffsetTop = targetElement.offsetTop; // Get the target's top offset relative to the document

    // Calculate scroll position considering the navigation bar height to avoid overlap.
    var navbarHeight = getVisibleNavbarHeight();
    window.scrollTo({
      top: targetOffsetTop - navbarHeight,
      behavior: 'smooth' // Smooth scroll to the target position
    });
  });
});

// Global variable to store author links
let authorLinks = {};

// Function to load author links
async function loadAuthorLinks() {
  try {
    const response = await fetch('data/authors.json');
    authorLinks = await response.json();
  } catch (error) {
    console.error('Error loading author links:', error);
  }
}

// Function to render publications from JSON data
async function renderPublications() {
  try {
    // Load both publications and author links
    await loadAuthorLinks();
    const response = await fetch('data/publications.json');
    const publications = await response.json();
    const filteredPublications = publications.filter(publication => publication.show);
    const container = document.getElementById('publications-container');
    
    filteredPublications.forEach(publication => {
      const publicationHTML = createPublicationHTML(publication);
      container.innerHTML += publicationHTML;
    });
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

  return `
        <${tag}${hrefAttr} class="paper-card fade-in delay-2${staticClass}">
          <div class="paper-card__media">
            <img src="${pub.image}" alt="${pub.title}">
          </div>
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
    const cls = item.isMisc ? 'buttom misc-button' : 'buttom';
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

  return `
        <div class="paper-container fade-in delay-2">
          <div class="paper-sidebar">
            <span class="${pub.venueType}"><strong>${venueText}</strong></span>
            ${sidebarLinksHTML}
          </div>
          <div class="paper-main">
            ${titleHTML}
            <p class="paper-authors">${authorsHTML}</p>
          </div>
          <div class="paper-image">
            <img src='${pub.image}' alt="${pub.id}">
          </div>${highlightsHTML}
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
