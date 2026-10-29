import { router } from 'expo-router';

// Called by request() once a 401 has cleared the session. A mounted list screen would otherwise sit
// on "Loading..." (clearing the query cache cancels its in-flight fetch silently), so send the user
// to sign-in. Must never throw: it runs before request() throws the ApiError, and the navigator may
// not be mounted yet.
export function redirectToSignIn(): void {
  try {
    router.replace('/');
  } catch (error) {
    console.warn('Failed to redirect to sign-in after 401', error instanceof Error ? error.message : 'unknown error');
  }
}
