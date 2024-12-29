import * as t from '@babel/types';

/**
 * Return true if (and only if) the current node is a
 * `injectGlobalCss()` function call.
 *
 * @param node
 * @returns if the node is `injectGlobalCss()`
 */
export const isInjectGlobalCss = (node: t.Node): boolean => {
  return (
    // TODO: update other injectGlobalCss usages in other places
    t.isCallExpression(node) &&
    t.isIdentifier(node.callee) &&
    node.callee.name === 'injectGlobalCss'
  );
};
