import { createHmac, timingSafeEqual } from "node:crypto";

function normalizeOriginValue(value) {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function matchesOriginPattern(origin, pattern) {
  const normalizedOrigin = normalizeOriginValue(origin);
  const normalizedPattern = normalizeOriginValue(pattern);
  if (!normalizedOrigin || !normalizedPattern) return false;
  if (normalizedOrigin === normalizedPattern) return true;

  // Support patterns like https://*.vercel.app for preview deployments.
  if (!normalizedPattern.includes("*")) return false;

  const escapedPattern = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const regex = new RegExp(`^${escapedPattern}$`);
  return regex.test(normalizedOrigin);
}

function isPrivateNetworkOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    if (!hostname) return false;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }

    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4Match) return false;

    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
      return false;
    }

    const [a, b] = octets;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  } catch (_error) {
    return false;
  }
}

export function isTrustedOrigin(origin, allowedOrigins, isProduction) {
  if (!origin) return true; // Native clients without browser cookies still require authentication.
  if (!isProduction && isPrivateNetworkOrigin(origin)) return true;
  return allowedOrigins.some((allowed) => matchesOriginPattern(origin, allowed));
}

export function verifySignature(payload, signature, secret) {
  if (typeof payload !== "string" || typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
