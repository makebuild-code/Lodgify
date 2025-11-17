export function nav() {
  let menu = document.querySelector('.nav_menu');
  document.querySelector('.nav_button').addEventListener('click', () => {
    menu.classList.toggle('is-nav-open')
    document.body.classList.toggle('u-overflow-hidden')
  });

  if (window.innerWidth > 767) {
    ScrollTrigger.create({
      trigger: document.body,
      start: '2rem top',
      end: 'bottom center',
      toggleClass: { targets: '.nav_wrap', className: 'is-scrolled' }
    })
  }
}