import { createError, unique, hash } from '@compiled/utils';
import autoprefixer from 'autoprefixer';
import postcss, { rule } from 'postcss';
import type { Plugin } from 'postcss';
import nested from 'postcss-nested';
import whitespace from 'postcss-normalize-whitespace';

import { atomicifyRules } from './plugins/atomicify-rules';
import { discardDuplicates } from './plugins/discard-duplicates';
import { discardEmptyRules } from './plugins/discard-empty-rules';
import { expandShorthands } from './plugins/expand-shorthands';
import { extractStyleSheets } from './plugins/extract-stylesheets';
import { increaseSpecificity } from './plugins/increase-specificity';
import { normalizeCSS } from './plugins/normalize-css';
import { parentOrphanedPseudos } from './plugins/parent-orphaned-pseudos';
import { sortAtomicStyleSheet } from './plugins/sort-atomic-style-sheet';

export interface TransformOpts {
  optimizeCss?: boolean;
  classNameCompressionMap?: Record<string, string>;
  increaseSpecificity?: boolean;
  sortAtRules?: boolean;
  sortShorthand?: boolean;
  classHashPrefix?: string;
}

/**
 * Will transform CSS into multiple CSS sheets.
 *
 * @param css CSS string
 * @param opts Transformation options
 */
export const transformCss = (
  css: string,
  opts: TransformOpts,
  isGlobal = false
): { sheets: string[]; classNames: string[] } => {
  const sheets: string[] = [];
  const classNames: string[] = [];

  console.log('css', css);

  try {
    const result = postcss([
      discardDuplicates(),
      discardEmptyRules(),
      parentOrphanedPseudos(),
      nested({
        bubble: ['container', '-moz-document', 'layer', 'else', 'when'],
        unwrap: ['color-profile', 'counter-style', 'font-palette-values', 'page', 'property'],
      }),
      ...normalizeCSS(opts),
      expandShorthands(),
      ...(isGlobal
        ? [
            groupGlobalRules({
              callback: (className: string) => classNames.push(className),
            }),
          ]
        : []),
      ...(!isGlobal
        ? [
            atomicifyRules({
              classNameCompressionMap: opts.classNameCompressionMap,
              callback: (className: string) => classNames.push(className),
              classHashPrefix: opts.classHashPrefix,
            }),
          ]
        : []),
      ...(opts.increaseSpecificity ? [increaseSpecificity()] : []),
      sortAtomicStyleSheet({
        sortAtRulesEnabled: opts.sortAtRules,
        sortShorthandEnabled: opts.sortShorthand,
      }),
      ...(process.env.AUTOPREFIXER === 'off' ? [] : [autoprefixer()]),
      whitespace(),
      extractStyleSheets({ callback: (sheet: string) => sheets.push(sheet) }),
    ]).process(css, {
      from: undefined,
    });

    // We need to access something to make the transformation happen.
    result.css;

    return {
      sheets,
      classNames: unique(classNames),
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : e;
    throw createError(
      'css',
      'Unhandled exception'
    )(
      `An unhandled exception was raised when parsing your CSS, this is probably a bug!
  Raise an issue here: https://github.com/atlassian-labs/compiled/issues/new?assignees=&labels=&template=bug_report.md&title=CSS%20Parsing%20Exception:%20

  Input CSS: {
    ${css}
  }

  Exception: ${message}`
    );
  }
};

const groupGlobalRules = ({ callback }): Plugin => {
  return {
    postcssPlugin: 'group-global-rules',

    OnceExit(root) {
      const uniqueName = hash(root.source?.input.css);
      const nodes = [];
      const orphanDecls = [];
      callback('.' + uniqueName);

      root.each((node) => {
        switch (node.type) {
          case 'decl':
            orphanDecls.push(node);
            break;

          case 'rule':
            nodes.push(
              node.clone({
                selector: `.${uniqueName} ${node.selector}`,
              })
            );
            break;

          case 'comment':
            node.remove();
            break;

          default:
            break;
        }
      });

      if (orphanDecls.length) {
        nodes.unshift(
          rule({
            raws: { before: '', after: '', between: '', selector: { raw: '', value: '' } },
            nodes: orphanDecls,
            selector: '.' + uniqueName,
          })
        );
      }

      root.nodes = nodes;
    },
  };
};
