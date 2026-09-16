// Resolve the same @/ aliases and extensionless JS imports that Next supports.
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
export async function resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith('@/')) url = pathToFileURL(path.resolve('src', specifier.slice(2)));
  else if (specifier.startsWith('.') && context.parentURL) url = new URL(specifier, context.parentURL);
  if (url) {
    for (const extension of ['', '.js', '.mjs']) {
      const candidate = new URL(url.href + extension);
      if (existsSync(candidate) && /\.(?:js|mjs)$/.test(candidate.pathname)) return { url: candidate.href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
