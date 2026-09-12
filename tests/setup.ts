// Global vitest setup. Node environment by default; component tests opt into jsdom with
// a leading `// @vitest-environment jsdom` comment in the test file.
import { afterEach } from 'vitest';

afterEach(() => {
  // Keep localStorage-backed stores isolated between tests when running under jsdom.
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
