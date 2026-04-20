async function digest(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashSecret(secret: string): Promise<string> {
  return digest(secret);
}

export function createNumericCode(length = 6): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10).toString()).join("");
}

export function createOpaqueToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, "")}`;
}
