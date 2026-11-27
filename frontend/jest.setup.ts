import "@testing-library/jest-dom";

// jsdom does not implement matchMedia. Tests run as a browser whose operating
// system is set to the light theme; a test that needs dark replaces this.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList;
