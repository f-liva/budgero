import { t } from '@lingui/core/macro';

/** Enable Banking accepts tokens valid for at most 24 hours; keep them short. */
const TOKEN_TTL_SECONDS = 60 * 60;

export interface EnableBankingCredentials {
  appId: string;
  privateKeyPem: string;
}

export class InvalidPrivateKeyError extends Error {
  constructor() {
    super(t`That file isn't an RSA private key. Upload the .pem Enable Banking gave you.`);
    this.name = 'InvalidPrivateKeyError';
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64Url(bytes: Uint8Array | string): string {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function derLength(length: number): number[] {
  if (length < 0x80) return [length];
  const bytes: number[] = [];
  for (let n = length; n > 0; n >>= 8) bytes.unshift(n & 0xff);
  return [0x80 | bytes.length, ...bytes];
}

function derNode(tag: number, content: Uint8Array | number[]): number[] {
  return [tag, ...derLength(content.length), ...content];
}

/** Wraps a PKCS#1 RSAPrivateKey (`openssl genrsa`) in PKCS#8, which WebCrypto needs. */
export function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const rsaEncryption = [
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ];
  const version = [0x02, 0x01, 0x00];
  return new Uint8Array(derNode(0x30, [...version, ...rsaEncryption, ...derNode(0x04, pkcs1)]));
}

export function pemToPkcs8(pem: string): Uint8Array {
  const match = pem.match(
    /-----BEGIN (RSA )?PRIVATE KEY-----([\s\S]+?)-----END \1?PRIVATE KEY-----/
  );
  if (!match) throw new InvalidPrivateKeyError();
  let der: Uint8Array;
  try {
    der = base64ToBytes(match[2].replace(/\s+/g, ''));
  } catch {
    throw new InvalidPrivateKeyError();
  }
  return match[1] ? pkcs1ToPkcs8(der) : der;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

export function importPrivateKey(pem: string): Promise<CryptoKey> {
  let key = keyCache.get(pem);
  if (!key) {
    key = (async () => {
      const der = pemToPkcs8(pem);
      try {
        return await crypto.subtle.importKey(
          'pkcs8',
          der,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['sign']
        );
      } catch {
        throw new InvalidPrivateKeyError();
      }
    })();
    key.catch(() => keyCache.delete(pem));
    keyCache.set(pem, key);
  }
  return key;
}

/** Signs the RS256 application JWT Enable Banking expects, entirely in the browser. */
export async function signEnableBankingJwt(
  { appId, privateKeyPem }: EnableBankingCredentials,
  now = Date.now()
): Promise<string> {
  const key = await importPrivateKey(privateKeyPem);
  const iat = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId.trim() }));
  const payload = base64Url(
    JSON.stringify({
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat,
      exp: iat + TOKEN_TTL_SECONDS,
    })
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Enable Banking names the downloaded key after the app ID (`<uuid>.pem`). */
export function appIdFromFileName(name: string): string | null {
  return name.match(UUID)?.[0]?.toLowerCase() ?? null;
}
