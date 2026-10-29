export async function signOut(clear: () => Promise<void>, navigate: (path: string) => void): Promise<void> {
  try {
    await clear();
  } catch (error) {
    // Log the message only; never the error object, which could carry stored values.
    console.warn('Failed to clear session on sign-out', error instanceof Error ? error.message : 'unknown error');
  } finally {
    navigate('/');
  }
}
