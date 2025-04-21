import { routing } from '~/i18n/routing';
import { unstable_isDraftModeRequest } from '@makeswift/runtime/next/middleware';

import { MiddlewareFactory } from './compose-middlewares';

const localeCookieName = ({ localeCookie }: { localeCookie?: boolean | { name?: string } }) =>
  (typeof localeCookie === 'object' ? localeCookie.name : undefined) ?? 'NEXT_LOCALE';

export const withMakeswift: MiddlewareFactory = (middleware) => {
  return async (request, event) => {
    console.warn('ENTERING MAKESWIFT MIDDLEWARE', {
      headers: new Map(request.headers),
      path: request.nextUrl.href,
    });

    if (unstable_isDraftModeRequest(request)) {
      console.log('Draft mode builder request detected', {
        headers: new Map(request.headers),
        url: request.nextUrl.href,
      });

      if (routing.localeCookie) {
        // If the i18n middleware is configured to use a cookie, it will first try to derive the
        // locale from the existing request cookie before attempting to match the URL against the
        // locale routes. The locale switcher in the Makeswift Builder expects the host to always
        // determine the locale from the URL, though, so we have to erase the cookie from the
        // proxied request to force that behavior.
        request.cookies.delete(localeCookieName(routing));
      }

      return middleware(request, event);
    }

    return middleware(request, event);
  };
};
