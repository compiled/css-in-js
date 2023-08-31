import type { CSSProps, CssObject } from '../types';
import { createSetupError } from '../utils/error';

/**
 * ## cssMap
 *
 * Creates a collection of named CSS rules that are statically typed and useable with other Compiled APIs.
 * For further details [read the documentation](https://compiledcssinjs.com/docs/api-cssmap).
 *
 * @example
 * ```
 * const borderStyleMap = cssMap({
 *     none: { borderStyle: 'none' },
 *     solid: { borderStyle: 'solid' },
 * });
 * const Component = ({ borderStyle }) => <div css={css(borderStyleMap[borderStyle])} />
 *
 * <Component borderStyle="solid" />
 * ```
 */
type returnType<T extends string, P> = Record<T, CSSProps<P>>;

export default function cssMap<T extends string, TProps = unknown>(
  _styles: Record<T, CssObject<TProps>>
): Readonly<returnType<T, TProps>> {
  throw createSetupError();
}
