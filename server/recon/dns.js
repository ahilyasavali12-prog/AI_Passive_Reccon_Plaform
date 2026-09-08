// Passive DNS reconnaissance: pure lookups against public DNS, no packets
// ever sent to the target itself.

import dns from "node:dns/promises";

async function safeResolve(fn, fallback = []) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function dnsRecon(domain) {
  const [a, aaaa, mx, ns, txt, cname] = await Promise.all([
    safeResolve(() => dns.resolve4(domain)),
    safeResolve(() => dns.resolve6(domain)),
    safeResolve(() => dns.resolveMx(domain)),
    safeResolve(() => dns.resolveNs(domain)),
    safeResolve(() => dns.resolveTxt(domain)),
    safeResolve(() => dns.resolveCname(domain)),
  ]);

  return {
    domain,
    a,
    aaaa,
    mx: mx.map((r) => `${r.exchange} (priority ${r.priority})`),
    ns,
    txt: txt.map((t) => t.join("")),
    cname,
    resolved: a.length > 0 || aaaa.length > 0 || cname.length > 0,
  };
}

export async function resolveA(hostname) {
  return safeResolve(() => dns.resolve4(hostname));
}
