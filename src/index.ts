import { resetWebflow } from "src/webflow/reset-webflow"
import { nav } from 'src/features/nav.js'

class _App {
  constructor() {
    this.init();
    console.log('tst');
  }

  init() {
    resetWebflow();
    nav()
  }
}

export const App = new _App();