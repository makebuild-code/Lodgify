import { resetWebflow } from "src/webflow/reset-webflow"

class _App {
  constructor() {
    this.init();
  }

  init() {
    resetWebflow();
  }
}

export const App = new _App();
