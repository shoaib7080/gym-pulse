const FORBIDDEN_KEY_PATTERN = /(password|pin|secret|token)/i;

/**
 * Scans an audit payload or object recursively to verify no sensitive keys exist.
 * Throws an Error if any key matches password, pin, secret, or token.
 */
export function assertNoSecretsInPayload(payload: unknown, path = ''): void {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  if (Array.isArray(payload)) {
    payload.forEach((item, index) => {
      assertNoSecretsInPayload(item, `${path}[${index}]`);
    });
    return;
  }

  const obj = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      throw new Error(
        `Forbidden sensitive key detected in audit payload: '${currentPath}'. Audit logs must never contain secrets, PINs, passwords, or tokens.`,
      );
    }
    if (value && typeof value === 'object') {
      assertNoSecretsInPayload(value, currentPath);
    }
  }
}
