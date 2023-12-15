import type { Rule } from 'eslint';
import type { JSXAttribute, JSXExpressionContainer } from 'estree-jsx';

type RuleModule = Rule.RuleModule;
type Node = Rule.Node;

const getAttributeNames = () =>
  ['css', 'xcss', 'cssMap'].map((name) => `[name.name="${name}"]`).join();

const isHoistedCss = (node: JSXAttribute): boolean => {
  // Get the JSX attribute container which should have all of the expressions for the node
  const { expression } = node.value as JSXExpressionContainer;

  // If it's a call expression, return false becuase no dynamic styling!!
  if (expression.type === 'CallExpression' || expression.type === 'ObjectExpression') {
    return false;
  }

  // If it's a conditional expression, check the consequent and alternate.
  // If either are NOT Identifiers, return false!!
  if (
    expression.type === 'ConditionalExpression' &&
    (expression.consequent.type !== 'Identifier' || expression.alternate.type !== 'Identifier')
  ) {
    return false;
  }

  // If it is an array expression, check if there is at least one ObjectExpression or CallExpression amongst its children
  // What do we do for Conditionals within collections? Do we check every single one?
  // What is the impact of this function if I made it recursive? Are there performance issues with this?

  return true;
};

const createUseHoistedCSSRule =
  (isHoistedCss: (node: JSXAttribute) => boolean, messageId: string): RuleModule['create'] =>
  (context) => {
    return {
      [`JSXAttribute:matches(${getAttributeNames()})`]: (node: Node) => {
        // Check the value which is a JSXExpressionContainer
        if (isHoistedCss(node as JSXAttribute)) {
          return;
        }
        context.report({
          messageId,
          node,
        });
      },
    };
  };

export const useHoistedCSSRule: Rule.RuleModule = {
  meta: {
    docs: {
      url: 'https://github.com/atlassian-labs/compiled/tree/master/packages/eslint-plugin/src/rules/no-empty-styled-expression',
    },
    messages: {
      unexpected:
        'Unexpected empty expression/empty object argument passed to styled.div() from @compiled/react',
    },
    type: 'problem',
  },
  create: createUseHoistedCSSRule(isHoistedCss, 'unexpected'),
};
