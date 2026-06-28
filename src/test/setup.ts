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

  if (!window.HTMLElement.prototype.hasPointerCapture) {
    Object.defineProperty(window.HTMLElement.prototype, 'hasPointerCapture', {
      configurable: true,
      value: (): boolean => false,
    });
  }

  if (!window.HTMLElement.prototype.setPointerCapture) {
    Object.defineProperty(window.HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: (): void => undefined,
    });
  }

  if (!window.HTMLElement.prototype.releasePointerCapture) {
    Object.defineProperty(window.HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: (): void => undefined,
    });
  }

  if (!window.HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: (): void => undefined,
    });
  }
}
