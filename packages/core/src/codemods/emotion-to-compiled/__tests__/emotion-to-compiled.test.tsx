jest.disableAutomock();

const defineInlineTest = require('jscodeshift/dist/testUtils').defineInlineTest;

import transformer from '../emotion-to-compiled';

describe('emotion-to-compiled transformer', () => {
  defineInlineTest(
    transformer,
    {},
    "import styled from '@emotion/styled';",
    "import { styled } from '@compiled/core';",
    'it transforms default @emotion/styled imports'
  );

  defineInlineTest(
    transformer,
    {},
    "import sc from '@emotion/styled';",
    "import { styled as sc } from '@compiled/core';",
    'it transforms default with different name than "styled" @emotion/styled imports'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import { css, jsx } from '@emotion/core';
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import '@compiled/core';
    `,
    'it transforms all named @emotion/core imports'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import { css as c, jsx } from '@emotion/core';
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import '@compiled/core';
    `,
    'it transforms all named @emotion/core imports with different imported name'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import { css, jsx } from '@emotion/core';
    import styled from '@emotion/styled';
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import { styled } from '@compiled/core';
    `,
    'it transforms all named @emotion/core and default @emotion/styled imports'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import { css as c, jsx } from '@emotion/core';
    import sc from '@emotion/styled';
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import { styled as sc } from '@compiled/core';
    `,
    'it transforms all named @emotion/core with different imported name and default with different name than "styled" @emotion/styled imports'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import { css, jsx } from '@emotion/core';
    import styled from '@emotion/styled';

    const Component = (props) => (
      <>
        <div
          css={css\`
            color: red;
            background-color: #000;
          \`}
        />
        <span css={css\` color: blue; \`} />
      </>
    );
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import { styled } from '@compiled/core';

    const Component = (props) => (
      <>
        <div
          css={\`
            color: red;
            background-color: #000;
          \`}
        />
        <span css={\` color: blue; \`} />
      </>
    );
    `,
    'it transforms and removes named @emotion/core "css" tagged template literal'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import { css as c, jsx } from '@emotion/core';
    import styled from '@emotion/styled';

    const Component = (props) => (
      <>
        <div
          css={c\`
            color: red;
            background-color: #000;
          \`}
        />
        <span css={c\` color: blue; \`} />
      </>
    );
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import { styled } from '@compiled/core';

    const Component = (props) => (
      <>
        <div
          css={\`
            color: red;
            background-color: #000;
          \`}
        />
        <span css={\` color: blue; \`} />
      </>
    );
    `,
    'it transforms and removes named @emotion/core with different imported name "css" tagged template literal'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import { jsx } from '@emotion/core';
    import styled from '@emotion/styled';

    const Component = (props) => (
      <div
        css={{
          color: 'red',
          backgroundColor: props.background,
        }}
      />
    );
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import { styled } from '@compiled/core';

    const Component = (props) => (
      <div
        css={{
          color: 'red',
          backgroundColor: props.background,
        }}
      />
    );
    `,
    'it should not transform when named @emotion/core "css" tagged template literal is not present'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import { jsx } from '@emotion/core';
    import styled from '@emotion/styled';

    const Component = (props) => (
      <div
        css={\`
          color: red;
          background-color: #000;
        \`}
      />
    );
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import { styled } from '@compiled/core';

    const Component = (props) => (
      <div
        css={\`
          color: red;
          background-color: #000;
        \`}
      />
    );
    `,
    'it should not transform when tagged template literal is not of type named @emotion/core "css"'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import _ from 'lodash';
    import { css, jsx } from '@emotion/core';
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import _ from 'lodash';
    import '@compiled/core';
    `,
    'it removes jsx pragma when @emotion/core is defined far from it'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import styled from '@emotion/styled';
    import { css, jsx } from '@emotion/core';
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import { styled } from '@compiled/core';
    `,
    'it removes jsx pragma when @emotion/core is defined far from it and @emotion/styled is present'
  );

  defineInlineTest(
    transformer,
    {},
    `
    /** @jsx jsx */
    import { css, jsx } from '@emotion/core';
    import styled from '@emotion/styled';
    import _ from 'lodash';
    `,
    `
    /* TODO: (from codemod) Emotion's JSX pragma has been removed. Please import appropriate JSX transformer.
    Eg. import React from 'react'; */
    import { styled } from '@compiled/core';
    import _ from 'lodash';
    `,
    'it ignores other imports'
  );

  defineInlineTest(
    transformer,
    {},
    "import react from 'react';",
    "import react from 'react';",
    'it should not transform when emotion imports are not present'
  );
});
