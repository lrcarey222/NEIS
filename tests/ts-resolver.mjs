// Lets the tests import the app's source the way the app itself does.
//
// Node 24 strips TypeScript types natively, but its ESM resolver still demands
// a file extension, while the source uses bundler-style extensionless imports
// ("./types"). This hook retries a failed relative resolution with .ts/.tsx
// appended, and maps the "@/..." alias onto src/. No build step, no extra
// dependency — the tests run against the same files Next.js compiles.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js"];

function firstExisting(basePath) {
  for (const extension of EXTENSIONS) {
    const candidate = `${basePath}${extension}`;
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  // Bare directory import, e.g. "./derive" -> "./derive/index.ts".
  for (const extension of EXTENSIONS) {
    const candidate = resolvePath(basePath, `index${extension}`);
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const url = firstExisting(resolvePath(SRC, specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
    }

    if (specifier.startsWith(".")) {
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        const parent = context.parentURL
          ? dirname(fileURLToPath(context.parentURL))
          : process.cwd();
        const url = firstExisting(resolvePath(parent, specifier));
        if (url) return { url, shortCircuit: true };
        throw error;
      }
    }

    return nextResolve(specifier, context);
  },
});
