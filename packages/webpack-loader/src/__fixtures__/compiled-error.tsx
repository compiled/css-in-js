import React from 'react';
import { css } from '@compiled/react';

// @ts-expect-error
const styles = css(false);

export const App = (): JSX.Element => <div css={styles} />;
