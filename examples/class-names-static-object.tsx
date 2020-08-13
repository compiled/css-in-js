import React from 'react';
import { ClassNames } from '@compiled/core';

export default {
  title: 'class names static object',
};

export const ObjectLiteral = () => (
  <ClassNames>
    {({ css }) => <div className={css({ fontSize: '30px' })}>hello world</div>}
  </ClassNames>
);
