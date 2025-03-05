import { routing } from '~/i18n/routing';
import {
  unstable_createMakeswiftDraftRequest,
  unstable_fetchMakeswiftDraftProxyResponse,
} from '@makeswift/runtime/next/middleware';
import { parse as parseSetCookie } from 'set-cookie-parser';

import { MiddlewareFactory } from './compose-middlewares';
import { strict } from 'assert';
import { NextRequest } from 'next/server';

const localeCookieName = ({ localeCookie }: { localeCookie?: boolean | { name?: string } }) =>
  (typeof localeCookie === 'object' ? localeCookie.name : undefined) ?? 'NEXT_LOCALE';

export const withMakeswift: MiddlewareFactory = (middleware) => {
  return async (request, event) => {
    console.warn('ENTERING MAKESWIFT MIDDLEWARE', {
      headers: new Map(request.headers),
      path: request.nextUrl.href,
    });

    strict(process.env.MAKESWIFT_SITE_API_KEY, 'MAKESWIFT_SITE_API_KEY is required');

    const draftRequest = await unstable_createMakeswiftDraftRequest(
      request,
      process.env.MAKESWIFT_SITE_API_KEY,
    );

    if (draftRequest != null) {
      console.log('Created draft request', {
        headers: new Map(draftRequest.headers),
        path: draftRequest.nextUrl.href,
      });

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

      console.warn('received proxy draft response', {
        headers: new Map(proxiedResponse.headers),
      });

      return proxiedResponse;
    }

    return middleware(request, event);
  };
};

// export const withMakeswift: MiddlewareFactory = (middleware) => {
//   return async (request, event) => {
//     console.warn('ENTERING MAKESWIFT MIDDLEWARE', {
//       headers: new Map(request.headers),
//       path: request.nextUrl.href,
//     });

//     const apiKey =
//       request.nextUrl.searchParams.get('x-makeswift-draft-mode') ??
//       request.headers.get('x-makeswift-draft-mode');

//     if (apiKey === process.env.MAKESWIFT_SITE_API_KEY) {
//       const draftModeUrl = new URL('/api/makeswift/draft-mode', request.nextUrl.origin);
//       draftModeUrl.searchParams.set('secret', apiKey);
//       console.warn('requesting draft mode from', draftModeUrl.href);
//       const response = await fetch(draftModeUrl);

//       const cookies = parseSetCookie(response.headers.get('set-cookie') || '');
//       const prerenderBypassValue = cookies.find((c) => c.name === '__prerender_bypass')?.value;

//       if (!prerenderBypassValue) {
//         return middleware(request, event);
//       }

//       // https://github.com/vercel/next.js/issues/52967#issuecomment-1644675602
//       // if we don't pass request twice, headers are stripped
//       const proxiedRequest = new NextRequest(request, request);

//       proxiedRequest.cookies.set('__prerender_bypass', prerenderBypassValue);
//       proxiedRequest.cookies.set(
//         'x-makeswift-draft-data',
//         JSON.stringify({ makeswift: true, siteVersion: 'Working' }),
//       );

//       if (routing.localeCookie) {
//         // If the i18n middleware is configured to use a cookie, it will first try to derive the
//         // locale from the existing request cookie before attempting to match the URL against the
//         // locale routes. The locale switcher in the Makeswift Builder expects the host to always
//         // determine the locale from the URL, though, so we have to erase the cookie from the
//         // proxied request to force that behavior.
//         proxiedRequest.cookies.delete(localeCookieName(routing));
//       }

//       return middleware(proxiedRequest, event);
//     }

//     return middleware(request, event);
//   };
// };
