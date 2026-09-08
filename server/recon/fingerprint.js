// Lightweight passive fingerprinting: a single HTTP(S) request to read
// response headers — no scanning, no exploitation, no auth attempts.

const SECURITY_HEADERS = ["strict-transport-security", "x-frame-options", "content-security-policy"];

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "manual" });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function fingerprintHost(hostname, { timeoutMs = 6000 } = {}) {
  let res;
  let scheme = "https";
  try {
    res = await fetchWithTimeout(`https://${hostname}`, timeoutMs);
  } catch {
    try {
      res = await fetchWithTimeout(`http://${hostname}`, timeoutMs);
      scheme = "http";
    } catch (err) {
      return { hostname, reachable: false, error: err.message };
    }
  }

  const headers = Object.fromEntries(res.headers.entries());
  const missingSecurityHeaders = SECURITY_HEADERS.filter((h) => !headers[h]);

  return {
    hostname,
    reachable: true,
    scheme,
    statusCode: res.status,
    server: headers["server"] ?? null,
    poweredBy: headers["x-powered-by"] ?? null,
    missingSecurityHeaders,
    hasHttps: scheme === "https",
  };
}
