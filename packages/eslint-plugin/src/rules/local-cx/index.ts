import type { Rule } from 'eslint';

export const localCXRule: Rule.RuleModule = {
  meta: {
    docs: {
      recommended: true,
      description:
        'The xcss prop is predicated on adhering to the type contract. Using it without TypeScript breaks this contract and thus is not allowed.',
      url: 'https://github.com/atlassian-labs/compiled/tree/master/packages/eslint-plugin/src/rules/no-js-xcss',
    },
    messages: {
      'no-js-xcss':
        'Using xcss in JavaScript risks incidents and unintended behaviour when code changes — only use inside TypeScript files',
    },
    type: 'problem',
  },
  create(context) {
    const violations = new WeakSet<Rule.Node>();

    return {
      'JSXAttribute[name.name=/[xX]css$/]': (node: Rule.Node) => {
        if (node.type === 'JSXAttribute' && !context.filename.endsWith('.tsx')) {
          violations.add(node);
          context.report({
            node: node.name,
            messageId: 'no-js-xcss',
          });
        }
      },
    };
  },
};
