export function hasMercadoPagoCredentials(
  accessToken: string | null,
  refreshToken: string | null,
) {
  accessToken = accessToken?.trim() ?? null;
  refreshToken = refreshToken?.trim() ?? null;

  const accessTokenPattern = /^APP_USR-\d+-\d+-[A-Za-z0-9]+-\d+$/;

  if (!accessToken || !accessTokenPattern.test(accessToken) || !refreshToken) {
    return false;
  }

  return true;
}
