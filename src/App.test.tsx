import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';

import { routes } from './App';

beforeAll(() => {
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
});

describe('App', () => {
  it('renders the imahe shell navigation', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);

    expect(screen.getByRole('link', { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Collections/i })).toBeInTheDocument();
  });
});
