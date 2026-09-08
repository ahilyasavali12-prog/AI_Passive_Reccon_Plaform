// Orchestrates a real passive reconnaissance run: DNS lookups, certificate
// transparency subdomain enumeration, and lightweight HTTP fingerprinting.
// Nothing here sends exploit traffic or attempts authentication — it's all
// public-data lookups and a single unauthenticated request per host, which
// is what makes it "passive."

import { dnsRecon } from "./dns.js";
import { enumerateSubdomains } from "./subdomains.js";
import { fingerprintHost } from "./fingerprint.js";
import { scoreSubdomain, findingsForSubdomain } from "./scoring.js";

const MAX_CONCURRENT_FINGERPRINTS = 5;

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function runPassiveRecon(target, organization, { onStep } = {}) {
  const now = () => new Date().toISOString();
  const notes = [];

  onStep?.(`Resolving DNS for ${target}…`);
  const dnsResult = await dnsRecon(target);

  onStep?.("Enumerating subdomains via certificate transparency logs…");
  const subResult = await enumerateSubdomains(target);
  if (!subResult.ok) notes.push(`Subdomain enumeration unavailable: ${subResult.error}`);

  const domainEntry = {
    asset: {
      name: target,
      type: "domain",
      organization,
      status: dnsResult.resolved ? "active" : "stale",
      riskScore: dnsResult.resolved ? 20 : 50,
      lastSeen: now(),
      metadata: { nsRecords: dnsResult.ns, mxRecords: dnsResult.mx, txtRecordCount: dnsResult.txt.length },
    },
    findings: [],
  };
  if (!dnsResult.resolved) {
    domainEntry.findings.push({
      title: `${target} did not resolve`,
      description: "No A/AAAA/CNAME records were found for the target domain.",
      severity: "medium",
      category: "dns-hygiene",
      evidence: "DNS lookup returned no address records.",
    });
  }

  onStep?.(`Fingerprinting ${subResult.subdomains.length} discovered subdomain(s)…`);
  const subdomainEntries = await mapWithConcurrency(subResult.subdomains, MAX_CONCURRENT_FINGERPRINTS, async (name) => {
    const fp = await fingerprintHost(name);
    const riskInfo = scoreSubdomain(name, fp);
    const findings = findingsForSubdomain(name, fp, riskInfo);
    return {
      asset: {
        name,
        type: "subdomain",
        organization,
        status: fp.reachable ? "active" : "stale",
        riskScore: riskInfo.riskScore,
        lastSeen: now(),
        metadata: { server: fp.server, poweredBy: fp.poweredBy, scheme: fp.scheme ?? null, reasons: riskInfo.reasons },
      },
      findings,
    };
  });

  onStep?.("Resolving IP addresses…");
  const ipMap = new Map();
  for (const ip of dnsResult.a) ipMap.set(ip, target);
  const ipEntries = Array.from(ipMap.entries()).map(([ip, viaHost]) => ({
    asset: {
      name: ip,
      type: "ip",
      organization,
      status: "active",
      riskScore: 15,
      lastSeen: now(),
      metadata: { resolvedFrom: viaHost },
    },
    findings: [],
  }));

  return {
    target,
    organization,
    entries: [domainEntry, ...ipEntries, ...subdomainEntries],
    subdomainSource: subResult,
    notes,
  };
}
