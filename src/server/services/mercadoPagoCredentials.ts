export async function hasMercadoPagoCredentials() {
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
  const secretKey = process.env.MP_SECRET_KEY?.trim();

  if (!accessToken || !secretKey) {
    return false;
  }

  // APP_USR-<digits>-<digits>-<alnum/hex>-<digits>
  const accessTokenPattern = /^APP_USR-\d+-\d+-[A-Za-z0-9]+-\d+$/;
  // MP webhook secret: 64 hex chars
  const secretKeyPattern = /^[a-fA-F0-9]{64}$/;

  if (
    !accessTokenPattern.test(accessToken) ||
    !secretKeyPattern.test(secretKey)
  ) {
    return false;
  }

  return true;
}
