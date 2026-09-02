type TokenConfig = {
  email: string;
  privateKey: string;
  scope: string;
  fetcher: typeof fetch;
};

export async function getGoogleAccessToken(config: TokenConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: config.email,
    scope: config.scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(config.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const assertion = `${header}.${claims}.${base64UrlBytes(new Uint8Array(signature))}`;
  const response = await config.fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`GOOGLE_AUTH_HTTP_${response.status}`);
  const result: unknown = await response.json();
  if (!isAccessTokenResponse(result)) throw new Error("GOOGLE_AUTH_INVALID_RESPONSE");
  return result.access_token;
}

function isAccessTokenResponse(value: unknown): value is { access_token: string } {
  return typeof value === "object" && value !== null && "access_token" in value &&
    typeof (value as { access_token?: unknown }).access_token === "string";
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(clean);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

function base64Url(value: string): string {
  return base64UrlBytes(new TextEncoder().encode(value));
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
