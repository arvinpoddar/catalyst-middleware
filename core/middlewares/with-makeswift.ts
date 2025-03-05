import { routing } from '~/i18n/routing';
import {
  unstable_createMakeswiftDraftRequest,
  unstable_fetchMakeswiftDraftProxyResponse,
} from '@makeswift/runtime/next/middleware';
import { parse as parseSetCookie } from 'set-cookie-parser';

import { MiddlewareFactory } from './compose-middlewares';
import { strict } from 'assert';
import { NextRequest, NextResponse } from 'next/server';

const localeCookieName = ({ localeCookie }: { localeCookie?: boolean | { name?: string } }) =>
  (typeof localeCookie === 'object' ? localeCookie.name : undefined) ?? 'NEXT_LOCALE';

async function fetchDraftProxyResponse(draftRequest: NextRequest): Promise<NextResponse> {
  // Passing `draftRequest.nextUrl` to fetch directly won't work when deployed
  // on Vercel - it results in a `TypeError: Invalid URL` error. Constructing
  // the URL works.

  const headers = new Headers({
    cookie: draftRequest.headers.get('cookie') ?? '',
  });

  console.warn('proxying with headers', { headers });

  const url = new URL(draftRequest.nextUrl, draftRequest.nextUrl.origin);

  const proxyResponse = await fetch(url, { headers });

  const response = new NextResponse(proxyResponse.body, {
    headers: proxyResponse.headers,
    status: proxyResponse.status,
  });

  console.warn({
    responseStatus: response.status,
  });

  // `fetch` automatically decompresses the response, but the response headers
  // will keep the `content-encoding` and `content-length` headers. This will
  // cause decoding issues if the client attempts to decompress the response
  // again. To prevent  this, we remove these headers.
  //
  // See https://github.com/nodejs/undici/issues/2514.
  // if (response.headers.has('content-encoding')) {
  //   response.headers.delete('content-encoding');
  //   response.headers.delete('content-length');
  // }

  return response;
}

// export const withMakeswift: MiddlewareFactory = (middleware) => {
//   return async (request, event) => {
//     console.warn('ENTERING MAKESWIFT MIDDLEWARE', {
//       //headers: new Map(request.headers),
//       path: request.nextUrl.href,
//     });

//     strict(process.env.MAKESWIFT_SITE_API_KEY, 'MAKESWIFT_SITE_API_KEY is required');

//     const draftRequest = await unstable_createMakeswiftDraftRequest(
//       request,
//       process.env.MAKESWIFT_SITE_API_KEY,
//     );

//     if (draftRequest != null) {
//       console.log('Created draft request', {
//         headers: new Map(draftRequest.headers),
//         path: draftRequest.nextUrl.href,
//       });

//       if (routing.localeCookie) {
//         // If the i18n middleware is configured to use a cookie, it will first try to derive the
//         // locale from the existing request cookie before attempting to match the URL against the
//         // locale routes. The locale switcher in the Makeswift Builder expects the host to always
//         // determine the locale from the URL, though, so we have to erase the cookie from the
//         // proxied request to force that behavior.
//         draftRequest.cookies.delete(localeCookieName(routing));
//       }

//       const proxiedResponse = await fetchDraftProxyResponse(draftRequest);

//       // Remove rewrite headers from the proxied response to allow this response
//       // to go through middleware again.
//       proxiedResponse.headers.delete('x-middleware-rewrite');
//       proxiedResponse.headers.delete('x-matched-path');
//       proxiedResponse.headers.delete('x-nextjs-prerender');
//       proxiedResponse.headers.delete('x-vercel-cache');
//       proxiedResponse.headers.delete('x-robots-tag');
//       proxiedResponse.headers.delete('x-vercel-id');

//       console.warn('received proxy draft response', {
//         headers: new Map(proxiedResponse.headers),
//       });

//       return proxiedResponse;
//     }

//     return middleware(request, event);
//   };
// };

export const withMakeswift: MiddlewareFactory = (middleware) => {
  return async (request, event) => {
    console.warn('ENTERING MAKESWIFT MIDDLEWARE', {
      headers: new Map(request.headers),
      path: request.nextUrl.href,
    });

    const draftRequest = await unstable_createMakeswiftDraftRequest(
      request,
      process.env.MAKESWIFT_SITE_API_KEY!,
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

      console.log({ draftHeaders: draftRequest.headers });

      return middleware(draftRequest, event);
    }

    return middleware(request, event);
  };
};
