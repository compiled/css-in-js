import { transformFromAstAsync, parseAsync } from '@babel/core';
import { toBoolean, createError } from '@compiled/utils';
import { getOptions } from 'loader-utils';
import { dirname, normalize } from 'path';
import type { LoaderContext } from 'webpack';

import { pluginName } from './extract-plugin';
import type { CompiledLoaderOptions } from './types';
import { toURIComponent } from './utils';

let hasErrored = false;

/**
 * Returns user configuration.
 *
 * @param context
 * @returns
 */
function getLoaderOptions(context: LoaderContext<CompiledLoaderOptions>) {
  const {
    bake = true,
    extract = false,
    importReact = undefined,
    nonce = undefined,
    resolve = {},
  }: CompiledLoaderOptions = typeof context.getOptions === 'undefined'
    ? // Webpack v4 flow
      getOptions(context)
    : // Webpack v5 flow
      context.getOptions({
        type: 'object',
        properties: {
          bake: {
            type: 'boolean',
          },
          extract: {
            type: 'boolean',
          },
          importReact: {
            type: 'boolean',
          },
          nonce: {
            type: 'string',
          },
          resolve: {
            type: 'object',
          },
        },
      });

  return {
    bake,
    extract,
    importReact,
    nonce,
    resolve,
  };
}

/**
 * Compiled webpack loader.
 *
 * @param this
 * @param code
 */
export default async function compiledLoader(
  this: LoaderContext<CompiledLoaderOptions>,
  code: string
): Promise<void> {
  const callback = this.async();

  // Bail early if Compiled isn't in the module.
  if (code.indexOf('@compiled/react') === -1) {
    return callback(null, code);
  }

  try {
    const includedFiles: string[] = [];
    const foundCSSRules: string[] = [];
    const { resolve, ...options } = getLoaderOptions(this);

    // Transform to an AST using the local babel config.
    const ast = await parseAsync(code, {
      filename: this.resourcePath,
      caller: { name: 'compiled' },
      rootMode: 'upward-optional',
    });

    // Setup the default resolver, where webpack will merge any passed in options with the default
    // resolve configuration
    const resolver = this.getResolve({
      ...resolve,
      // This makes the resolver invoke the callback synchronously
      useSyncFileSystemCalls: true,
    });

    // Transform using the Compiled Babel Plugin - we deliberately turn off using the local config.
    const result = await transformFromAstAsync(ast!, code, {
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      filename: this.resourcePath,
      plugins: [
        options.extract && [
          '@compiled/babel-plugin-strip-runtime',
          { onFoundStyleRules: (rules: string[]) => foundCSSRules.push(...rules) },
        ],
        options.bake && [
          '@compiled/babel-plugin',
          {
            ...options,
            onIncludedFiles: (files: string[]) => includedFiles.push(...files),
            resolver: {
              // The resolver needs to be synchronous, as babel plugins must be synchronous
              resolveSync: (context: string, request: string) => {
                let resolvedErr;
                let resolvedPath;

                resolver(dirname(context), request, (err, path) => {
                  resolvedErr = err;
                  resolvedPath = path;
                });

                if ((!resolvedPath && !resolvedErr) || !resolvedPath) {
                  throw new Error(`Failed to resolve ${request} in ${context}`);
                }

                if (resolvedErr) {
                  throw resolvedErr;
                }

                return resolvedPath;
              },
            },
          },
        ],
      ].filter(toBoolean),
    });

    includedFiles.forEach((file) => {
      this.addDependency(normalize(file));
    });

    let output: string = result?.code || '';

    if (options.extract && foundCSSRules.length) {
      foundCSSRules.forEach((rule) => {
        // Each found atomic rule will create a new import that uses `@compiled/webpack-loader/css-loader`.
        // The benefit is two fold:
        // (1) thread safe collection of styles
        // (2) caching -- resulting in faster builds (one import per rule!)
        const params = toURIComponent(rule);

        // We use require instead of import so it works with both ESM and CJS source.
        // If we used ESM it would blow up with CJS source, unfortunately.
        output = `
  require("@compiled/webpack-loader/css-loader!@compiled/webpack-loader/css-loader/extract.css?style=${params}");
  ${output}`;
      });
    }

    callback(null, output, result?.map ?? undefined);
  } catch (e) {
    const error = createError('compiled-loader', 'Unhandled exception')(e.stack);
    callback(error);
  }
}

export function pitch(this: LoaderContext<CompiledLoaderOptions>): void {
  const options = getLoaderOptions(this);

  // @ts-expect-error No definitions for this[pluginName]
  if (!hasErrored && options.extract && !this[pluginName]) {
    this.emitError(
      createError('webpack-loader')(
        `You forgot to add the 'CompiledExtractPlugin' plugin (i.e \`{ plugins: [new CompiledExtractPlugin()] }\`), please read https://compiledcssinjs.com/docs/css-extraction-webpack`
      )
    );

    // We only want to error once, if we didn't do this you'd get an error for every file found.
    hasErrored = true;
  }
}
