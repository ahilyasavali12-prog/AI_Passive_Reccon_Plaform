// Passive subdomain enumeration via certificate transparency logs (crt.sh).
// Purely passive: reads public CT log data, never touches the target.

const CRTSH_URL = (domain) => `https://crt.sh/?q=%.${encodeURIComponent(domain)}&output=json`;
const MAX_SUBDOMAINS = 15;

async function fetchOnce(domain, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(CRTSH_URL(domain), { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`crt.sh responded ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err.name === "AbortError" ? new Error("crt.sh request timed out") : err;
  }
}

// crt.sh is a free, often slow/overloaded public service — retry once with a
// longer timeout before giving up, since a single transient timeout
// shouldn't sink the whole recon run.
export async function enumerateSubdomains(domain, { timeoutMs = 20000, limit = MAX_SUBDOMAINS } = {}) {
  let rows;
  let lastError;
  for (const attemptTimeout of [timeoutMs, timeoutMs * 1.5]) {
    try {
      rows = await fetchOnce(domain, attemptTimeout);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) return { subdomains: [], source: "crt.sh", ok: false, error: lastError.message };

  const names = new Set();
  for (const row of rows) {
    for (const raw of String(row.name_value ?? "").split("\n")) {
      const name = raw.trim().toLowerCase().replace(/^\*\./, "");
      if (name && name !== domain && name.endsWith(`.${domain}`)) {
        names.add(name);
      }
    }
  }

  return { subdomains: Array.from(names).slice(0, limit), source: "crt.sh", ok: true, totalFound: names.size };
}
