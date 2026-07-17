import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

export const deepLinkConfig = {
  prefixes: [Linking.createURL('/'), 'https://trekriderz.app', 'trekriderz://'],
  config: {
    screens: {
      'trip/[id]': 'trip/:id',
      'post/[id]': 'post/:id',
      'user/[id]': 'user/:id',
      '(tabs)': {
        screens: {
          index: 'home',
          explore: 'explore',
          notifications: 'notifications',
          profile: 'profile',
        },
      },
    },
  },
};

// Parses both query (?key=val) and hash fragment (#key=val) params from a URL.
function parseAllParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const combined = url.replace(/.*[?#]/, (m) => (m.endsWith('?') ? '?' : '#') === m ? '' : m);

  // Extract everything after the first ? or #
  const qIndex = url.indexOf('?');
  const hIndex = url.indexOf('#');

  const parts: string[] = [];
  if (qIndex !== -1) {
    const end = hIndex !== -1 && hIndex > qIndex ? hIndex : url.length;
    parts.push(url.slice(qIndex + 1, end));
  }
  if (hIndex !== -1) {
    parts.push(url.slice(hIndex + 1));
  }

  parts.join('&').split('&').forEach((pair) => {
    const eq = pair.indexOf('=');
    if (eq !== -1) {
      const key = decodeURIComponent(pair.slice(0, eq));
      const value = decodeURIComponent(pair.slice(eq + 1));
      params[key] = value;
    }
  });

  return params;
}

export async function handleDeepLink(url: string) {
  try {
    const parsed = Linking.parse(url);
    const { path, hostname } = parsed;

    console.log('Deep link:', url);

    // 1. Supabase auth callback — contains access_token, refresh_token, code, or error_description
    const allParams = parseAllParams(url);
    const isAuthCallback =
      allParams.access_token ||
      allParams.refresh_token ||
      allParams.code ||
      allParams.error_description ||
      allParams.type === 'signup' ||
      allParams.type === 'recovery' ||
      allParams.type === 'email_change';

    if (isAuthCallback) {
      // Build query string for the confirm screen
      const qs = new URLSearchParams();
      if (allParams.access_token) qs.set('access_token', allParams.access_token);
      if (allParams.refresh_token) qs.set('refresh_token', allParams.refresh_token);
      if (allParams.code) qs.set('code', allParams.code);
      if (allParams.error_description) qs.set('error_description', allParams.error_description);
      router.replace(`/auth/confirm?${qs.toString()}` as any);
      return;
    }

    // 2. External links
    if (url.startsWith('http') && !url.includes('trekriderz.app')) {
      await WebBrowser.openBrowserAsync(url);
      return;
    }

    // 3. Internal deep links
    if (path) {
      if (path.startsWith('trip/')) {
        router.push(`/trip/${path.split('/')[1]}` as any);
      } else if (path.startsWith('post/')) {
        router.push(`/post/${path.split('/')[1]}` as any);
      }
    }
  } catch (error) {
    console.error('Deep link handling error:', error);
  }
}
