import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? null;
}

async function requestCsv(path: string, fallbackFilename: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${getToken() ?? ''}`,
      },
    });
  } catch {
    const message = 'Network error — unable to reach the server. Please check your connection and try again.';
    notifyApiError(message);
    throw new Error(message);
  }

  const body = await res.text().catch(() => '');
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(body) as { message?: string } | null;
      message = parsed?.message ?? message;
    } catch {
      // Keep the fallback message when the response is not JSON.
    }
    notifyApiError(message);
    throw new Error(message);
  }

  const filename = filenameFromContentDisposition(res.headers.get('content-disposition')) ?? fallbackFilename;
  const link = document.createElement('a');
  link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(body)}`;
  link.download = filename;
  link.rel = 'noopener';
  link.click();
}

export function downloadIngredientsCsv(): Promise<void> {
  return requestCsv('/export/ingredients', 'ingredients.csv');
}

export function downloadRecipesCsv(): Promise<void> {
  return requestCsv('/export/recipes', 'recipes.csv');
}
