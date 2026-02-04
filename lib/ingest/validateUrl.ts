const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254",
  "[::1]",
];

const PRIVATE_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^fc00:/,
  /^fd/,
  /^fe80:/,
];

export function validateUrl(urlString: string): { valid: boolean; error?: string } {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { valid: false, error: "Only http and https URLs are allowed" };
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTS.includes(hostname)) {
    return { valid: false, error: "Blocked host" };
  }

  for (const range of PRIVATE_RANGES) {
    if (range.test(hostname)) {
      return { valid: false, error: "Private IP range not allowed" };
    }
  }

  return { valid: true };
}
