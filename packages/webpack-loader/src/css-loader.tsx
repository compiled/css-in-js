import { URLSearchParams } from 'url';
import type { LoaderThis } from './types';

/**
 * CSSLoader will take the style query params added by `./compiled-loader.tsx` and turn it into CSS.
 */
export default function CSSLoader(this: LoaderThis): string {
  const query = new URLSearchParams(this.resourceQuery);
  const styleRule = query.get('style');
  return styleRule || '';
}

/**
 * Move the CSS loader to the end of the loader queue so it runs first.
 */
export function pitch(this: any): void {
  if (this.loaders[0].path !== __filename) {
    return;
  }

  const firstLoader = this.loaders.shift();
  this.loaders.push(firstLoader);
}
