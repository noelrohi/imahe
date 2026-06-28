import { QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { createAppQueryClient } from './lib/query';
import { routeTree } from './routeTree.gen';

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

  window.scrollTo = (): void => undefined;
});

describe('App', () => {
  it('renders the imahe shell navigation', async () => {
    const queryClient = createAppQueryClient();
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    await router.load();

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('link', { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Collections/i })).toBeInTheDocument();
  });
});
