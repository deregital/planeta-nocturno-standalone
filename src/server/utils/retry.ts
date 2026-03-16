export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  // Función de retry para manejar rate limits
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error: unknown) {
      lastError = error;

      // Verificar si es un error 429 (rate limit) de diferentes formas posibles
      const isRateLimit =
        (error as { status?: number })?.status === 429 ||
        (error as { response?: { status?: number } })?.response?.status ===
          429 ||
        (error as { statusCode?: number })?.statusCode === 429 ||
        (error as { code?: number })?.code === 429 ||
        (error as { message?: string })?.message?.includes('rate limit') ||
        (error as { message?: string })?.message?.includes('429') ||
        (error as { message?: string })?.message
          ?.toLowerCase()
          .includes('too many requests');

      if (!isRateLimit) {
        throw error;
      }

      // Si es rate limit pero ya no tenemos más intentos, lanzar el error
      if (attempt >= maxRetries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
