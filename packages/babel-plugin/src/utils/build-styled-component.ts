import generate from '@babel/generator';
import template from '@babel/template';
import type { NodePath } from '@babel/traverse';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { transformCss } from '@compiled/css';
import { unique } from '@compiled/utils';
import isPropValid from '@emotion/is-prop-valid';

import { PROPS_IDENTIFIER_NAME } from '../constants';
import type { Metadata, Tag } from '../types';

import { pickFunctionBody } from './ast';
import { buildCssVariables } from './build-css-variables';
import { getItemCss } from './css-builders';
import { hoistSheet } from './hoist-sheet';
import { applySelectors, transformCssItems } from './transform-css-items';
import type { CSSOutput, CssItem } from './types';

export interface StyledTemplateOpts {
  /**
   * Class to be used for the CSS selector.
   */
  classNames: t.Expression[];

  /**
   * Tag for the Styled Component, for example "div" or user defined component.
   */
  tag: Tag;

  /**
   * CSS variables to be passed to the `style` prop.
   */
  variables: CSSOutput['variables'];

  /**
   * CSS sheets to be passed to the `CS` component.
   */
  sheets: string[];
}

/**
 * Builds up the inline style prop value for a Styled Component.
 *
 * @param variables CSS variables that will be placed in the AST
 * @param transform Transform callback function that can be used to change the CSS variable expression
 */
const styledStyleProp = (
  variables: CSSOutput['variables'],
  transform?: (expression: t.Expression) => t.Expression
) => {
  const props: (t.ObjectProperty | t.SpreadElement)[] = [t.spreadElement(t.identifier('style'))];
  return t.objectExpression(props.concat(buildCssVariables(variables, transform)));
};

/**
 * Returns a tag string in the form of an identifier or string literal.
 *
 * A type of InBuiltComponent will return a string literal,
 * otherwise an identifier string will be returned.
 *
 * @param tag Made of name and type.
 */
const buildComponentTag = ({ name, type }: Tag) => {
  return type === 'InBuiltComponent' ? `"${name}"` : name;
};

/**
 * Traverses a binary expression looking for any arrow functions,
 * and replaces each found arrow function node with its body.
 *
 * @param node Binary expression node
 * @param nestedVisitor Visitor callback function
 */

const traverseStyledBinaryExpression = (node: t.BinaryExpression) => {
  traverse(node, {
    noScope: true,
    ArrowFunctionExpression(path) {
      path.replaceWith(pickFunctionBody(path.node));
      path.stop();
    },
  });

  return node;
};

/**
 * Returns a list of props used in expressions of a styled component
 *
 * For example:
 * ```
 * const Component = styled.div`
 *  width: $({ width }) => `${width}px`;
 *  height: $({ height }) => `${height}px`;
 * `;
 * ```
 * Returns list of [width, height]
 *
 * @param node {t.Node} Node of the styled component
 */
const getPropsInArrowFunctionExpressions = (node: t.Node): string[] => {
  const destructuredProps: string[] = [];

  traverse(node, {
    noScope: true,
    ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
      const body = path.node.body;

      if (t.isConditionalExpression(body) && t.isMemberExpression(body.test)) {
        const propertyName = (body.test.property as t.Identifier).name;
        destructuredProps.push(propertyName);
      } else if (t.isMemberExpression(body)) {
        const propertyName = (body.property as t.Identifier).name;
        destructuredProps.push(propertyName);
      }
    },
  });

  return destructuredProps;
};

/***
 * If prop is a valid html attribute let it through - else destructure to prevent
 */
const getValidHtmlAttributes = (propsList: string[]): string => {
  return unique(propsList)
    .filter((prop: string) => isPropValid(prop))
    .map((prop: string) => `${prop}: ${PROPS_IDENTIFIER_NAME}.${prop},`)
    .join('');
};

/**
 * Will return a generated AST for a Styled Component.
 *
 * @param opts {StyledTemplateOpts} Template options
 * @param meta {Metadata} Useful metadata that can be used during the transformation
 */
const styledTemplate = (opts: StyledTemplateOpts, meta: Metadata): t.Node => {
  const nonceAttribute = meta.state.opts.nonce ? `nonce={${meta.state.opts.nonce}}` : '';
  const styleProp = opts.variables.length
    ? styledStyleProp(opts.variables, (node) => {
        if (t.isArrowFunctionExpression(node)) {
          return pickFunctionBody(node);
        }

        if (t.isBinaryExpression(node)) {
          return traverseStyledBinaryExpression(node);
        }

        return node;
      })
    : t.identifier('style');

  let unconditionalClassNames = '',
    conditionalClassNames = '';

  opts.classNames.forEach((item) => {
    if (t.isStringLiteral(item)) {
      unconditionalClassNames += `${item.value} `;
    } else if (t.isLogicalExpression(item) || t.isConditionalExpression(item)) {
      conditionalClassNames += `${generate(item).code}, `;
    }
  });

  const classNames = `"${unconditionalClassNames.trim()}", ${conditionalClassNames}`;

  // This completely depends on meta.parentPath.node to be the styled component.
  // If this changes please pass the component in another way
  const propsList: string[] = getPropsInArrowFunctionExpressions(meta.parentPath.node);
  const HTML_ATTRIBUTES = getValidHtmlAttributes(propsList);

  return template(
    `
  forwardRef(({
    as: C = ${buildComponentTag(opts.tag)},
    style,
    ...${PROPS_IDENTIFIER_NAME}
  }, ref) => (
    <CC>
      <CS ${nonceAttribute}>{%%cssNode%%}</CS>
      <C
      {...{${HTML_ATTRIBUTES} children: ${PROPS_IDENTIFIER_NAME}.children}}
        style={%%styleProp%%}
        ref={ref}
        className={ax([${classNames} ${PROPS_IDENTIFIER_NAME}.className])}
      />
    </CC>
  ));
`,
    {
      plugins: ['jsx'],
    }
  )({
    styleProp,
    cssNode: t.arrayExpression(unique(opts.sheets).map((sheet: string) => hoistSheet(sheet, meta))),
  }) as t.Node;
};

/**
 * Find CSS selectors that are apart of incomplete closures
 * i.e. `:hover {`
 *
 * @param css {string} Template options
 */
const findOpenSelectors = (css: string): string[] | null => {
  // Remove any occurrence of { or } inside quotes to stop them
  // interfering with closure matches
  let searchArea = css.replace(/['|"].*[{|}].*['|"]/g, '');
  // Skip over complete closures
  searchArea = searchArea.substring(searchArea.lastIndexOf('}') + 1);

  // Regex for CSS selector
  //[^;\s] Don't match ; or whitespace
  // .+\n?{ Match anything (the selector itself) followed by any newlines then {
  return searchArea.match(/[^;\s].+\n?{/g);
};

/**
 * Returns a Styled Component AST.
 *
 * @param tag {Tag} Styled tag either an inbuilt or user define
 * @param cssOutput {CSSOutput} CSS and variables to place onto the component
 * @param meta {Metadata} Useful metadata that can be used during the transformation
 */
export const buildStyledComponent = (tag: Tag, cssOutput: CSSOutput, meta: Metadata): t.Node => {
  let unconditionalCss = '';
  const conditionalCssItems: CssItem[] = [];

  cssOutput.css.forEach((item) => {
    if (item.type === 'logical' || item.type === 'conditional') {
      // TODO: Optimize this to only run if there is a
      // potential selector scope change
      const selectors = findOpenSelectors(unconditionalCss);

      if (selectors) {
        applySelectors(item, selectors);
      }

      conditionalCssItems.push(item);
    } else {
      unconditionalCss += getItemCss(item);
    }
  });

  // Rely on transformCss to remove duplicates and return only the last unconditional CSS for each property
  const uniqueUnconditionalCssOutput = transformCss(unconditionalCss);

  // Rely on transformItemCss to build expressions for conditional & logical CSS
  const conditionalCssOutput = transformCssItems(conditionalCssItems);

  const sheets = [...uniqueUnconditionalCssOutput.sheets, ...conditionalCssOutput.sheets];
  const classNames = [
    ...[t.stringLiteral(uniqueUnconditionalCssOutput.classNames.join(' '))],
    ...conditionalCssOutput.classNames,
  ];

  return styledTemplate(
    {
      classNames,
      tag,
      sheets,
      variables: cssOutput.variables,
    },
    meta
  );
};
