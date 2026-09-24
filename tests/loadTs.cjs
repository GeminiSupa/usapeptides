const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

/**
 * Load a TypeScript module in a plain `node --test` run.
 *
 * The pure parts of the email automation code are written in TypeScript next
 * to the code that uses them, rather than duplicated into a .js file that can
 * drift. This transpiles on the fly - types only, no type checking, which
 * `npx tsc --noEmit` already does - and resolves relative imports the same way.
 */
const cache = new Map();

function loadTs(file) {
  const full = path.resolve(__dirname, '..', file);
  if (cache.has(full)) return cache.get(full);

  const source = fs.readFileSync(full, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    fileName: full,
  });

  const mod = new Module(full, null);
  mod.filename = full;
  mod.paths = Module._nodeModulePaths(path.dirname(full));
  // Relative imports inside the module resolve against its own folder; a
  // '@/lib/x' import would need the alias, and these modules do not use one.
  mod.require = (request) =>
    request.startsWith('.')
      ? loadTs(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(full), `${request}.ts`)))
      : require(request);

  cache.set(full, mod.exports);
  mod._compile(outputText, full);
  cache.set(full, mod.exports);
  return mod.exports;
}

module.exports = { loadTs };
