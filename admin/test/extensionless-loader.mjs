// See resolve-extensionless.mjs.
export async function resolve(specifier, context, nextResolve) {
  if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?js$|\.json$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.js`, context);
    } catch {
      // Not a file of its own; let Node report it as usual.
    }
  }
  return nextResolve(specifier, context);
}
