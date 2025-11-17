// Store ScrollTrigger instances for cleanup
let scrollTriggers = [];

// Helper function to find uiv_wrap in the next section after logos_wrap section
function findUivWrapInNextSection(logosWrapSection) {
  // Find the next section after the logos_wrap section
  let nextSection = logosWrapSection.nextElementSibling;

  while (nextSection) {
    // Check if this sibling is a section
    if (nextSection.tagName.toLowerCase() === 'section') {
      // Look for uiv_wrap inside this section
      let uivWrap = nextSection.querySelector('.uiv_wrap');
      if (uivWrap) {
        return uivWrap;
      }
    }
    nextSection = nextSection.nextElementSibling;
  }

  return null;
}

// Cleanup function to kill all ScrollTriggers and clear element props
function cleanup() {
  // Kill all ScrollTriggers
  scrollTriggers.forEach(st => {
    if (st && st.kill) {
      st.kill();
    }
  });
  scrollTriggers = [];

  // Clear GSAP properties from all logo elements
  const logos = document.querySelectorAll('[data-logo-anim="logo"]');
  logos.forEach(logo => {
    gsap.killTweensOf(logo);
    gsap.set(logo, { clearProps: 'all' });
  });

  // Clear GSAP properties from all UIV logo elements
  const uivLogos = document.querySelectorAll('.uiv_logo');
  uivLogos.forEach(logo => {
    gsap.killTweensOf(logo);
    gsap.set(logo, { clearProps: 'all' });
  });
}

// Main animation setup function
function setupAnimations() {
  gsap.registerPlugin(Flip, ScrollTrigger);

  // Clean up existing animations first
  cleanup();

  if (window.innerWidth < 767) return;

  // Get all logos_wrap sections on the page (logos_wrap IS the section)
  let logosWraps = document.querySelectorAll('section.logos_wrap');

  if (!logosWraps.length) {
    console.warn('No section.logos_wrap elements found');
    return;
  }

  // Process each logos_wrap section
  logosWraps.forEach((logosWrapSection) => {
    // Find the next section after this logos_wrap section and look for uiv_wrap inside it
    let uivWrap = findUivWrapInNextSection(logosWrapSection);

    if (!uivWrap) {
      return;
    }

    // Get logos within this specific logos_wrap section
    let logos = logosWrapSection.querySelectorAll('[data-logo-anim="logo"]');

    if (!logos.length) {
      return;
    }

    // Process each logo in this section
    logos.forEach((logo) => {
      // Store the initial state before any changes
      let state;

      // Get the logo ID from data attribute
      let logoId = logo.getAttribute('data-logo-id');

      // Switch case for different logo types
      switch (logoId) {
        case 'google':
          state = Flip.getState(uivWrap.querySelector('.uiv_logo.is-google'));
          break;
        case 'expedia':
          state = Flip.getState(uivWrap.querySelector('.uiv_logo.is-expedia'));
          break;
        case 'airbnb':
          state = Flip.getState(uivWrap.querySelector('.uiv_logo.is-airbnb'));
          break;
        case 'booking':
          state = Flip.getState(uivWrap.querySelector('.uiv_logo.is-booking'));
          break;
        case 'vrbo':
          state = Flip.getState(uivWrap.querySelector('.uiv_logo.is-vrbo'));
          break;
        default:
          state = Flip.getState(uivWrap.querySelector('.uiv_logo.is-airbnb'));
          break;
      }

      // Create timeline scoped to this specific section
      let tl = gsap.timeline({
        scrollTrigger: {
          trigger: logosWrapSection, // Use the specific logosWrap element
          endTrigger: uivWrap, // Use the specific uivWrap element
          start: 'center center',
          end: 'center center',
          scrub: 1.2,
        }
      });

      // Store the ScrollTrigger instance for cleanup
      if (tl.scrollTrigger) {
        scrollTriggers.push(tl.scrollTrigger);
      }

      tl.add(Flip.fit(logo, state, {
        scale: true,
        duration: 1,
        absolute: true
      }));
    });
  });

  // Refresh ScrollTrigger after setup to recalculate positions
  ScrollTrigger.refresh();
}

// GSAP debounced resize handler function
function callAfterResize(func, delay) {
  let dc = gsap.delayedCall(delay || 0.2, func).pause(),
    handler = () => dc.restart(true);
  window.addEventListener("resize", handler);
  return handler; // in case you want to window.removeEventListener() later
}

export function logoAnimation() {
  // Initial setup
  setupAnimations();

  // Setup debounced resize handler
  callAfterResize(() => {
    setupAnimations();
  });
}