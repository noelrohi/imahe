import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    const noop = (): void => undefined;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string): MediaQueryList =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: noop,
          removeListener: noop,
          addEventListener: noop,
          removeEventListener: noop,
          dispatchEvent: (): boolean => false,
        }) as MediaQueryList,
    });
  }

  window.scrollTo = (): void => undefined;
}
