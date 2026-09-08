// Heuristic risk scoring + finding generation from passive recon signals.
// Deterministic, rule-based — no LLM involved here; the LLM layer (AI
// triage / VAPT report) runs on top of whatever this produces.

const SENSITIVE_PATTERNS = [
  { pattern: /^(dev|develop)\b/i, label: "development environment naming" },
  { pattern: /^(staging|stage|uat|qa)\b/i, label: "pre-production environment naming" },
  { pattern: /^(admin|administrator|manage|portal)\b/i, label: "administrative interface naming" },
  { pattern: /^(vpn|remote|ssh)\b/i, label: "remote access service naming" },
  { pattern: /^(db|database|sql|mysql|postgres|mongo)\b/i, label: "database service naming" },
  { pattern: /^(backup|old|legacy|archive)\b/i, label: "legacy/backup naming" },
  { pattern: /^(internal|private|corp)\b/i, label: "internal-only naming" },
  { pattern: /^(git|gitlab|jenkins|jira|confluence)\b/i, label: "developer tooling naming" },
  { pattern: /^(grafana|kibana|elastic|prometheus)\b/i, label: "observability tooling naming" },
];

function riskFromFingerprint(fp) {
  if (!fp.reachable) return { score: 5, reasons: ["host did not respond to a passive request"] };
  let score = 10;
  const reasons = [];
  if (!fp.hasHttps) {
    score += 25;
    reasons.push("no HTTPS");
  }
  if (fp.missingSecurityHeaders?.length) {
    score += fp.missingSecurityHeaders.length * 8;
    reasons.push(`missing ${fp.missingSecurityHeaders.length} security header(s)`);
  }
  if (fp.server) {
    score += 10;
    reasons.push(`server banner disclosed: ${fp.server}`);
  }
  if (fp.poweredBy) {
    score += 10;
    reasons.push(`technology disclosed: ${fp.poweredBy}`);
  }
  return { score, reasons };
}

export function scoreSubdomain(name, fingerprint) {
  const { score: fpScore, reasons } = riskFromFingerprint(fingerprint);
  let score = fpScore;
  const sensitive = SENSITIVE_PATTERNS.find((p) => p.pattern.test(name));
  if (sensitive) {
    score += 25;
    reasons.push(sensitive.label);
  }
  return { riskScore: Math.min(score, 100), reasons, sensitive: Boolean(sensitive) };
}

export function findingsForSubdomain(name, fingerprint, riskInfo) {
  const findings = [];
  if (!fingerprint.reachable) return findings;

  if (!fingerprint.hasHttps) {
    findings.push({
      title: `${name} does not enforce HTTPS`,
      description: "The host responded over plain HTTP with no HTTPS endpoint available.",
      severity: "high",
      category: "misconfiguration",
      evidence: `Fetched http://${name} — no HTTPS endpoint responded within the request window.`,
    });
  }
  if (fingerprint.missingSecurityHeaders?.length >= 2) {
    findings.push({
      title: `${name} missing key security headers`,
      description: `Response is missing ${fingerprint.missingSecurityHeaders.join(", ")}.`,
      severity: "low",
      category: "misconfiguration",
      evidence: `HTTP response headers did not include: ${fingerprint.missingSecurityHeaders.join(", ")}`,
    });
  }
  if (fingerprint.server) {
    findings.push({
      title: `${name} discloses server software in response headers`,
      description: "The Server header reveals backend software/version information useful for targeted attacks.",
      severity: "informational",
      category: "information-disclosure",
      evidence: `Server: ${fingerprint.server}`,
    });
  }
  if (riskInfo.sensitive) {
    findings.push({
      title: `${name} appears to be a sensitive internal-facing host`,
      description: "Subdomain naming suggests a non-production or administrative system exposed to the internet.",
      severity: "medium",
      category: "shadow-it",
      evidence: `Passive certificate-transparency lookup exposed hostname: ${name}`,
    });
  }
  return findings;
}
