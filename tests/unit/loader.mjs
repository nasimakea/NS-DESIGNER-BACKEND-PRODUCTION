// Tiny ESM loader so unit tests can import src files that use the "@/" alias and extension-less paths.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");

function tryFile(base) {
  for (const candidate of [base, `${base}.js`, path.join(base, "index.js")]) {
    if (existsSync(candidate) && !candidate.endsWith(path.sep)) {
      try {
        if (candidate.endsWith(".js") || candidate.endsWith(".mjs")) return candidate;
      } catch {}
    }
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const file = tryFile(path.join(SRC, specifier.slice(2)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const file = tryFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  if (/^next\/[a-z-]+$/.test(specifier)) {
    return next(`${specifier}.js`, context);
  }
  return next(specifier, context);
}
