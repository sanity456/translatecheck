import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('../', import.meta.url));
const requireDependency = createRequire(import.meta.url);

// Execute actual TS/TSX helpers without adding a browser or another test runtime.
// Only the external store tests replace React hooks and the Embla/media adapters.
function loadUi(
  path: string,
  overrides: Record<string, unknown> = {},
  globals: Record<string, unknown> = {},
) {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  function load(pathname: string): Record<string, unknown> {
    const file = [pathname, pathname + '.tsx', pathname + '.ts'].find(
      existsSync,
    );
    if (!file) throw new Error('Missing test module: ' + pathname);
    const cached = cache.get(file);
    if (cached) return cached.exports;
    const loadedModule = { exports: {} as Record<string, unknown> };
    cache.set(file, loadedModule);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    runInNewContext(
      code,
      {
        module: loadedModule,
        exports: loadedModule.exports,
        require: (specifier: string) => {
          if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
          if (specifier.startsWith('@/'))
            return load(resolve(root, specifier.slice(2)));
          if (specifier.startsWith('.'))
            return load(resolve(dirname(file), specifier));
          return requireDependency(specifier) as unknown;
        },
        ...globals,
      },
      { filename: file },
    );
    return loadedModule.exports;
  }
  return load(resolve(root, path));
}

function markup(
  path: string,
  name: string,
  props: Record<string, unknown> = {},
) {
  const Component = loadUi(path)[name] as React.ComponentType<
    Record<string, unknown>
  >;
  return renderToStaticMarkup(React.createElement(Component, props));
}

void test('native group helpers retain their slots and children', () => {
  for (const [file, name, slot] of [
    ['button-group', 'ButtonGroup', 'button-group'],
    ['input-group', 'InputGroup', 'input-group'],
    ['field', 'Field', 'field'],
  ]) {
    const html = markup(`components/ui/${file}.tsx`, name, {
      'aria-label': 'Controls',
      children: 'Child content',
    });
    assert.match(html, /^<fieldset/);
    assert.ok(html.includes(`data-slot="${slot}"`));
    assert.match(html, /aria-label="Controls"/);
    assert.match(html, /Child content/);
    if (slot === 'input-group') {
      // The input retains its existing visible outline; layout groups do not.
      assert.match(html, /rounded-lg border /);
      assert.doesNotMatch(html, /border-0/);
    } else {
      assert.match(html, /border-0/);
    }
  }
});

void test('current breadcrumb and generic item group do not claim interactive/list roles', () => {
  const breadcrumb = markup('components/ui/breadcrumb.tsx', 'BreadcrumbPage', {
    children: 'Current page',
  });
  assert.match(breadcrumb, /aria-current="page"/);
  assert.doesNotMatch(breadcrumb, /role="link"|aria-disabled/);
  const items = markup('components/ui/item.tsx', 'ItemGroup', {
    children: 'Content',
  });
  assert.doesNotMatch(items, /role="list"/);
});

void test('spinner has one named status and its icon/OTP decoration are hidden', () => {
  const spinner = markup('components/ui/spinner.tsx', 'Spinner', {
    'aria-label': 'Checking translation',
  });
  assert.match(spinner, /^<output[^>]*aria-label="Checking translation"/);
  assert.match(spinner, /<svg[^>]*aria-hidden="true"/);
  assert.doesNotMatch(spinner, /<svg[^>]*role="status"/);
  const separator = markup('components/ui/input-otp.tsx', 'InputOTPSeparator');
  assert.match(separator, /aria-hidden="true"/);
  assert.doesNotMatch(separator, /role="separator"/);
});

void test('label association and pagination link content survive wrapper composition', () => {
  const label = markup('components/ui/label.tsx', 'Label', {
    htmlFor: 'email',
    children: 'Email address',
  });
  assert.match(label, /<label[^>]*for="email"[^>]*>Email address<\/label>/);
  const pagination = markup('components/ui/pagination.tsx', 'PaginationLink', {
    href: '/?page=2',
    children: 'Page 2',
    isActive: true,
  });
  assert.match(pagination, /<a[^>]*href="\/\?page=2"/);
  assert.match(pagination, /aria-current="page"/);
  assert.match(pagination, /Page 2<\/a>/);
});

void test('input addon delegates pointer focus without stealing nested button clicks', () => {
  const Addon = loadUi('components/ui/input-group.tsx').InputGroupAddon as (
    props: Record<string, unknown>,
  ) => React.ReactElement<{ onClick: (event: unknown) => void }>;
  const element = Addon({ children: 'Prefix' });
  assert.equal(element.type, 'fieldset');
  let focused = 0;
  let nestedButton = false;
  let selector = '';
  const event = {
    target: { closest: () => (nestedButton ? {} : null) },
    currentTarget: {
      parentElement: {
        querySelector: (query: string) => {
          selector = query;
          return {
            focus: () => {
              focused++;
            },
          };
        },
      },
    },
  };
  element.props.onClick(event);
  assert.equal(focused, 1);
  assert.equal(selector, 'input, textarea');
  nestedButton = true;
  element.props.onClick(event);
  assert.equal(focused, 1);
});

type Store = {
  subscribe: (notify: () => void) => () => void;
  snapshot: () => boolean;
  server: () => boolean;
};

void test('mobile breakpoint subscribes to matchMedia and cleans up without an effect-setState', () => {
  const stores: Store[] = [];
  const listeners = new Set<() => void>();
  let width = 767;
  const media = {
    get matches() {
      return width < 768;
    },
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  };
  const exports = loadUi(
    'hooks/use-mobile.ts',
    {
      react: {
        ...React,
        useSyncExternalStore: (
          subscribe: Store['subscribe'],
          snapshot: Store['snapshot'],
          server: Store['server'],
        ) => {
          stores.push({ subscribe, snapshot, server });
          return snapshot();
        },
      },
    },
    {
      window: {
        matchMedia: (query: string) => {
          assert.equal(query, '(max-width: 767px)');
          return media;
        },
      },
    },
  );
  assert.equal((exports.useIsMobile as () => boolean)(), true);
  const [store] = stores;
  assert.equal(store.server(), false);
  let notifications = 0;
  const cleanup = store.subscribe(() => {
    notifications++;
  });
  width = 768;
  for (const listener of listeners) listener();
  assert.equal(store.snapshot(), false);
  assert.equal(notifications, 1);
  cleanup();
  assert.equal(listeners.size, 0);
});

void test('mobile helper has a server-safe snapshot with no window object', () => {
  const exports = loadUi('hooks/use-mobile.ts', {
    react: {
      ...React,
      useSyncExternalStore: (
        _subscribe: Store['subscribe'],
        _snapshot: Store['snapshot'],
        server: Store['server'],
      ) => server(),
    },
  });
  assert.equal((exports.useIsMobile as () => boolean)(), false);
});

void test('carousel reads live scroll state and cleans up select and reInit listeners', () => {
  const stores: Store[] = [];
  const listeners = new Map<string, Set<() => void>>();
  let previous = false;
  let next = true;
  const api = {
    canScrollPrev: () => previous,
    canScrollNext: () => next,
    on: (event: string, listener: () => void) => {
      const set = listeners.get(event) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(event, set);
    },
    off: (event: string, listener: () => void) =>
      listeners.get(event)?.delete(listener),
  };
  const exports = loadUi('components/ui/carousel.tsx', {
    react: {
      ...React,
      useCallback: (callback: unknown) => callback,
      useEffect: () => {},
      useSyncExternalStore: (
        subscribe: Store['subscribe'],
        snapshot: Store['snapshot'],
        server: Store['server'],
      ) => {
        stores.push({ subscribe, snapshot, server });
        return snapshot();
      },
    },
    'embla-carousel-react': () => [() => {}, api],
  });
  const Carousel = exports.Carousel as (
    props: Record<string, unknown>,
  ) => React.ReactElement<{
    value: { canScrollPrev: boolean; canScrollNext: boolean };
    children: React.ReactElement;
  }>;
  const element = Carousel({ children: 'Slide' });
  assert.equal(element.props.value.canScrollPrev, false);
  assert.equal(element.props.value.canScrollNext, true);
  assert.equal(element.props.children.type, 'section');
  assert.equal(stores.length, 2);
  let notifications = 0;
  const cleanups = stores.map((store) =>
    store.subscribe(() => {
      notifications++;
    }),
  );
  previous = true;
  next = false;
  for (const listener of listeners.get('reInit') ?? []) listener();
  assert.equal(notifications, 2);
  assert.equal(stores[0].snapshot(), true);
  assert.equal(stores[1].snapshot(), false);
  for (const cleanup of cleanups) cleanup();
  assert.equal(listeners.get('select')?.size, 0);
  assert.equal(listeners.get('reInit')?.size, 0);
});
