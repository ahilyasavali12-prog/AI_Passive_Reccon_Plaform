// Passive subdomain enumeration via certificate transparency logs (crt.sh).
// Purely passive: reads public CT log data, never touches the target.

const CRTSH_URL = (domain) => `https://crt.sh/?q=%.${encodeURIComponent(domain)}&output=json`;
const MAX_SUBDOMAINS = 15;

export async function enumerateSubdomains(domain, { timeoutMs = 12000, limit = MAX_SUBDOMAINS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(CRTSH_URL(domain), { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!res.ok) return { subdomains: [], source: "crt.sh", ok: false, error: `crt.sh responded ${res.status}` };

    const rows = await res.json();
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
  } catch (err) {
    clearTimeout(timer);
    const message = err.name === "AbortError" ? "crt.sh request timed out" : err.message;
    return { subdomains: [], source: "crt.sh", ok: false, error: message };
  }
}
