// Main JavaScript file for the website

// Get the height of the mobile and desktop navigation bars
var navbarHeightMobile = document.querySelector('.mobile-component ul').offsetHeight;
var navbarHeightDesktop = document.querySelector('.desktop-component ul').offsetHeight;

// Add click event listeners to navigation links
document.querySelectorAll('.mobile-component ul li a, .desktop-component ul li a, .a').forEach(function(anchor) {
    anchor.addEventListener('click', function(event) {
        event.preventDefault(); // Prevent the default navigation behavior

        var targetId = this.getAttribute('href'); // Get the target section's ID from the link's href
        var targetElement = document.querySelector(targetId); // Find the target element using its ID
        var targetOffsetTop = targetElement.offsetTop; // Get the target's top offset relative to the document

        // Calculate scroll position considering the navigation bar height to avoid overlap
        var navbarHeight = (window.innerWidth < 768) ? navbarHeightMobile : navbarHeightDesktop;
        window.scrollTo({
            top: targetOffsetTop - navbarHeight,
            behavior: 'smooth' // Smooth scroll to the target position
        });
    });
});

// Scroll to top button functionality
var scrollToTopBtn = document.getElementById("scroll-to-top");

window.onscroll = function() {
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
    scrollToTopBtn.style.display = "block";
  } else {
    scrollToTopBtn.style.display = "none";
  }
};

scrollToTopBtn.addEventListener("click", function() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

// Function to check button links and apply styles based on URL validity
function disableEmptyLinks() {
  // Get all buttom elements with anchors
  var buttons = document.querySelectorAll('strong.buttom');
  
  // Debug count
  console.log("Found " + buttons.length + " buttons with class 'buttom'");
  
  // Process each button
  buttons.forEach(function(button) {
    var anchor = button.querySelector('a');
    
    // If anchor exists and has an empty or "#" href
    if (anchor && (!anchor.getAttribute('href') || anchor.getAttribute('href') === '' || anchor.getAttribute('href') === '#')) {
      console.log("Empty link found:", anchor);
      
      // Add disabled class
      button.className += ' buttom-disabled';
      
      // Directly apply inline styles for maximum specificity
      button.style.opacity = "0.5";
      button.style.cursor = "not-allowed";
      button.style.backgroundColor = "#e0e0e0";
      button.style.color = "#999";
      
      // Style the anchor
      anchor.style.color = "#999";
      anchor.style.pointerEvents = "none";
      
      // Prevent click events
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
    }
  });
}

// Toggle visibility of random thoughts
document.getElementById('thoughts-toggle').addEventListener('click', function() {
  const content = document.getElementById('thoughts-content');
  const icon = this.querySelector('i');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    icon.className = 'fas fa-chevron-down';
  } else {
    content.style.display = 'none';
    icon.className = 'fas fa-chevron-right';
  }
});

// Function to render publications from JSON data
async function renderPublications() {
  try {
    const response = await fetch('data/publications.json');
    const publications = await response.json();
    
    const container = document.getElementById('publications-container');
    
    publications.forEach(publication => {
      const publicationHTML = createPublicationHTML(publication);
      container.innerHTML += publicationHTML;
    });
  } catch (error) {
    console.error('Error loading publications:', error);
  }
}

// Function to create HTML for a single publication
function createPublicationHTML(pub) {
  // Generate authors string
  let authorsHTML = '';
  pub.authors.forEach((author, index) => {
    let authorName = author.name;
    
    if (author.isHighlight) {
      authorName = `<u><strong>${authorName}</strong></u>`;
    }
    
    if (author.isCoFirst) {
      authorName += '<sup>*</sup>';
    }
    
    authorsHTML += authorName;
    
    if (index < pub.authors.length - 1) {
      authorsHTML += ',\n              ';
    }
  });
  
  // Generate links HTML
  let linksHTML = '';
  for (const [linkType, url] of Object.entries(pub.links)) {
    if (url && url !== '') {
      let iconClass = '';
      let linkText = '';
      
      switch (linkType) {
        case 'paper':
          iconClass = 'fas fa-file-pdf';
          linkText = 'Paper';
          break;
        case 'code':
          iconClass = 'fab fa-github';
          linkText = 'Code';
          break;
        case 'project':
          iconClass = 'fas fa-globe';
          linkText = 'Project Page';
          break;
        case 'demo':
          iconClass = 'fas fa-globe';
          linkText = 'Demo';
          break;
        case 'benchmark':
          iconClass = 'fas fa-database';
          linkText = 'Benchmark';
          break;
        default:
          iconClass = 'fas fa-link';
          linkText = linkType.charAt(0).toUpperCase() + linkType.slice(1);
      }
      
      linksHTML += `<a href="${url}" class="buttom"><i class="${iconClass}"></i> ${linkText}</a>\n              `;
    }
  }
  
  // Start paragraph without co-first authorship note
  const coFirstNote = '<p>\n              ';
  
  return `
        <div class="paper-container fade-in delay-2">
          <div class="image">
            <img src='${pub.image}' alt="${pub.id}">
          </div>
          <div class="text">
            <span class="papertitle">${pub.title}</span><br>
            
            ${coFirstNote}${authorsHTML}
              <br>
            </p>
      
            <p>
              <span class="${pub.venueType}"><strong>${pub.venue}</strong></span>
              ${linksHTML}
            </p>
          </div>
        </div>`;
}

// Run when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function() {
    disableEmptyLinks();
    renderPublications();
  });
} else {
  // DOM already loaded, run now
  disableEmptyLinks();
  renderPublications();
}

// Also run after window load (for good measure)
window.addEventListener('load', function() {
  disableEmptyLinks();
}); 