import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** One source of truth: the policy in netlify.toml is also written into the built page, so it holds on any host. */
function cspMeta() {
  const toml = readFileSync('netlify.toml', 'utf8');
  const csp = /Content-Security-Policy = "([^"]+)"/.exec(toml)?.[1] ?? '';
  // frame-ancestors only works as a real header, not in a meta tag
  const metaCsp = csp.replace(/;?\s*frame-ancestors [^;]+/, '');
  return {
    name: 'csp-meta',
    apply: 'build' as const,
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: metaCsp },
        injectTo: 'head-prepend' as const
      }
    ]
  };
}

export default defineConfig({
  plugins: [react(), cspMeta()],
  test: { include: ['src/**/*.test.ts'] }
});
