import { logoAnimation } from './modules/logo-animation.js';
import { howItWorks } from './modules/how-it-works.js';
import { pricing } from './modules/pricing.js';
import { nav } from './modules/nav.js';
import { countdown } from './modules/countdown.js';

document.addEventListener('DOMContentLoaded', () => {
  logoAnimation();
  howItWorks();
  pricing();
  nav()
  countdown()
});
