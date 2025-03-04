import { routing } from '~/i18n/routing';
import {
  unstable_createMakeswiftDraftRequest,
  unstable_fetchMakeswiftDraftProxyResponse,
} from '@makeswift/runtime/next/middleware';

import { MiddlewareFactory } from './compose-middlewares';
import { strict } from 'assert';

const localeCookieName = ({ localeCookie }: { localeCookie?: boolean | { name?: string } }) =>
  (typeof localeCookie === 'object' ? localeCookie.name : undefined) ?? 'NEXT_LOCALE';

export const withMakeswift: MiddlewareFactory = (middleware) => {
  return async (request, event) => {
    strict(process.env.MAKESWIFT_SITE_API_KEY, 'MAKESWIFT_SITE_API_KEY is required');

    const draftRequest = await unstable_createMakeswiftDraftRequest(
      request,
      process.env.MAKESWIFT_SITE_API_KEY,
    );

    if (draftRequest != null) {
      if (routing.localeCookie) {
        // If the i18n middleware is configured to use a cookie, it will first try to derive the
        // locale from the existing request cookie before attempting to match the URL against the
        // locale routes. The locale switcher in the Makeswift Builder expects the host to always
        // determine the locale from the URL, though, so we have to erase the cookie from the
        // proxied request to force that behavior.
        draftRequest.cookies.delete(localeCookieName(routing));
      }

      const proxiedResponse = await unstable_fetchMakeswiftDraftProxyResponse(draftRequest);

      // Remove rewrite headers from the proxied response to allow this response
      // to go through middleware again.
      proxiedResponse.headers.delete('x-middleware-rewrite');

      return proxiedResponse;
    }

    return middleware(request, event);
  };
};
