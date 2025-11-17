// export a function that loops over all the [data-module="how-it-works"] elements and runs this function on them. the function needs a param of (element) which the element we loop over will be. 

export function howItWorks() {
  const howItWorksElements = document.querySelectorAll('[data-module="how-it-works"]');
  howItWorksElements.forEach((howItWorksElement) => {
    howItWorksLogic(howItWorksElement);
  });
}

// write the main logic function that we will run on how it works. the function will just register gsap scrolltrigger.
function howItWorksLogic(element) {
  // when the element is scrolled into view (center center), trigger an animation. 
  // the animation will move the 3 .ll_line_inner elements to x: 0%, one after the other in order

  let duration = 3

  gsap.registerPlugin(ScrollTrigger);
  let timeline = gsap.timeline({
    scrollTrigger: {
      trigger: element,
      start: 'top center',
    },
    defaults: {
      duration,
      ease: 'power2.inOut',
    }
  });

  // Loop through the 3 elements instead of repeating code
  for (let i = 0; i < 3; i++) {
    timeline.to(gsap.utils.toArray(element.querySelectorAll('.ll_line_inner'))[i], {
      x: '0%', // On mobile, move to x: 0, on desktop also x: 0
      y: '0%',
      duration: duration,
      ease: 'power2.inOut',
    }, '>-0.5');
    timeline.to(gsap.utils.toArray(element.querySelectorAll('.ll_wrap'))[i], {
      opacity: 1,
      duration: duration / 2,
    }, '<');
    timeline.to(gsap.utils.toArray(element.querySelectorAll('.ll_icon'))[i], {
      color: '#FF3B57',
      duration: duration / 2,
    }, '<');
  }
}