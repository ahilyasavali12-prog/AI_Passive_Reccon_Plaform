const ORG = "demo-org";
const now = Date.now();
const hoursAgo = (h) => new Date(now - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);

export const assets = [
  { id: 1, name: "www.demo-org.com", type: "domain", organization: ORG, status: "active", riskScore: 42, lastSeen: hoursAgo(1), metadata: { registrar: "NameCheap", tls: "valid" } },
  { id: 2, name: "api.demo-org.com", type: "subdomain", organization: ORG, status: "active", riskScore: 68, lastSeen: hoursAgo(2), metadata: { framework: "Express", exposedDocs: true } },
  { id: 3, name: "staging.demo-org.com", type: "subdomain", organization: ORG, status: "active", riskScore: 81, lastSeen: hoursAgo(3), metadata: { auth: "none", robotsBlocked: false } },
  { id: 4, name: "vpn.demo-org.com", type: "subdomain", organization: ORG, status: "active", riskScore: 35, lastSeen: hoursAgo(5), metadata: { vendor: "OpenVPN" } },
  { id: 5, name: "mail.demo-org.com", type: "subdomain", organization: ORG, status: "active", riskScore: 22, lastSeen: hoursAgo(6), metadata: { spf: true, dkim: true, dmarc: "quarantine" } },
  { id: 6, name: "dev.demo-org.com", type: "subdomain", organization: ORG, status: "stale", riskScore: 74, lastSeen: daysAgo(9), metadata: { framework: "Flask debug mode" } },
  { id: 7, name: "203.0.113.10", type: "ip", organization: ORG, status: "active", riskScore: 55, lastSeen: hoursAgo(4), metadata: { asn: "AS64500", ports: [22, 80, 443] } },
  { id: 8, name: "203.0.113.11", type: "ip", organization: ORG, status: "active", riskScore: 30, lastSeen: hoursAgo(4), metadata: { asn: "AS64500", ports: [443] } },
  { id: 9, name: "203.0.113.25", type: "ip", organization: ORG, status: "archived", riskScore: 10, lastSeen: daysAgo(40), metadata: { asn: "AS64500", note: "decommissioned" } },
  { id: 10, name: "*.demo-org.com", type: "certificate", organization: ORG, status: "active", riskScore: 15, lastSeen: hoursAgo(12), metadata: { issuer: "Let's Encrypt", expires: daysAgo(-60) } },
  { id: 11, name: "mail.demo-org.com TLS cert", type: "certificate", organization: ORG, status: "stale", riskScore: 60, lastSeen: daysAgo(20), metadata: { issuer: "Let's Encrypt", expires: daysAgo(-3) } },
  { id: 12, name: "nginx 1.18.0 (api.demo-org.com:443)", type: "service", organization: ORG, status: "active", riskScore: 48, lastSeen: hoursAgo(2), metadata: { banner: "nginx/1.18.0" } },
  { id: 13, name: "OpenSSH 7.6p1 (203.0.113.10:22)", type: "service", organization: ORG, status: "active", riskScore: 65, lastSeen: hoursAgo(4), metadata: { banner: "OpenSSH_7.6p1 Ubuntu" } },
  { id: 14, name: "PostgreSQL (203.0.113.11:5432)", type: "service", organization: ORG, status: "active", riskScore: 90, lastSeen: hoursAgo(4), metadata: { exposedToInternet: true } },
  { id: 15, name: "elastic.demo-org.com", type: "subdomain", organization: ORG, status: "active", riskScore: 88, lastSeen: hoursAgo(7), metadata: { authRequired: false, service: "Elasticsearch" } },
  { id: 16, name: "grafana.demo-org.com", type: "subdomain", organization: ORG, status: "active", riskScore: 40, lastSeen: hoursAgo(8), metadata: { defaultCreds: "unknown" } },
  { id: 17, name: "s3-assets.demo-org.com", type: "subdomain", organization: ORG, status: "active", riskScore: 52, lastSeen: hoursAgo(10), metadata: { cdn: "CloudFront" } },
  { id: 18, name: "legacy-api.demo-org.com", type: "subdomain", organization: ORG, status: "stale", riskScore: 77, lastSeen: daysAgo(15), metadata: { deprecated: true } },
  { id: 19, name: "chat.demo-org.com", type: "subdomain", organization: ORG, status: "active", riskScore: 58, lastSeen: hoursAgo(1), metadata: { note: "LLM-backed support widget" } },
  { id: 20, name: "203.0.113.40", type: "ip", organization: ORG, status: "active", riskScore: 20, lastSeen: hoursAgo(6), metadata: { asn: "AS64500" } },
];

export const findings = [
  { id: 1, title: "PostgreSQL exposed directly to the internet", description: "Port 5432 is reachable from outside the VPC with no firewall restriction.", severity: "critical", status: "open", assetId: 14, category: "exposed-service", detectedAt: hoursAgo(4), evidence: "nmap: 203.0.113.11:5432 open, TCP handshake completed without auth challenge" },
  { id: 2, title: "Elasticsearch cluster accepts unauthenticated queries", description: "The elastic.demo-org.com cluster returns index data without credentials.", severity: "critical", status: "open", assetId: 15, category: "misconfiguration", detectedAt: hoursAgo(7), evidence: "GET /_cat/indices returned 200 with no Authorization header" },
  { id: 3, title: "Expired TLS certificate on mail subdomain", description: "The certificate for mail.demo-org.com expired 3 days ago, degrading mail client trust.", severity: "high", status: "open", assetId: 11, category: "certificate", detectedAt: daysAgo(3), evidence: "openssl s_client: notAfter reported in the past" },
  { id: 4, title: "Flask debug mode enabled on dev subdomain", description: "Werkzeug debugger is reachable, allowing arbitrary code execution via the debug console.", severity: "critical", status: "investigating", assetId: 6, category: "misconfiguration", detectedAt: daysAgo(9), evidence: "Response contained Werkzeug interactive traceback with console PIN prompt" },
  { id: 5, title: "Outdated OpenSSH version with known CVEs", description: "OpenSSH 7.6p1 is affected by multiple disclosed vulnerabilities.", severity: "high", status: "open", assetId: 13, category: "vulnerable-software", detectedAt: hoursAgo(4), evidence: "Banner grab: SSH-2.0-OpenSSH_7.6p1 Ubuntu-4ubuntu0.7" },
  { id: 6, title: "Grafana instance using default credentials", description: "admin/admin credentials accepted on the Grafana login form.", severity: "high", status: "open", assetId: 16, category: "weak-credentials", detectedAt: hoursAgo(8), evidence: "POST /login with admin:admin returned 200 and a valid session cookie" },
  { id: 7, title: "Legacy API still reachable and unmonitored", description: "A deprecated API version remains publicly accessible and is not covered by current monitoring.", severity: "medium", status: "open", assetId: 18, category: "shadow-it", detectedAt: daysAgo(15), evidence: "DNS record still resolves; no alerting configured for this host" },
  { id: 8, title: "Missing DMARC enforcement", description: "DMARC policy is set to quarantine rather than reject, allowing partial spoofing.", severity: "medium", status: "accepted", assetId: 5, category: "email-security", detectedAt: hoursAgo(6), evidence: "DNS TXT _dmarc.demo-org.com: v=DMARC1; p=quarantine" },
  { id: 9, title: "S3-backed asset bucket allows directory listing", description: "The CloudFront-fronted asset bucket returns a full object listing when queried without a key.", severity: "medium", status: "open", assetId: 17, category: "misconfiguration", detectedAt: hoursAgo(10), evidence: "GET / on s3-assets.demo-org.com returned XML ListBucketResult" },
  { id: 10, title: "Staging environment has no authentication", description: "staging.demo-org.com serves a full copy of production with no login wall.", severity: "high", status: "investigating", assetId: 3, category: "misconfiguration", detectedAt: hoursAgo(3), evidence: "HTTP 200 on / with production-like content and no auth redirect" },
  { id: 11, title: "API host exposes OpenAPI docs without auth", description: "api.demo-org.com/docs discloses full endpoint schema publicly.", severity: "low", status: "open", assetId: 2, category: "information-disclosure", detectedAt: hoursAgo(2), evidence: "GET /docs returned Swagger UI with all internal routes listed" },
  { id: 12, title: "Support chat widget backed by LLM lacks input filtering", description: "chat.demo-org.com forwards raw user input directly to the model with no PII or prompt-injection controls.", severity: "high", status: "open", assetId: 19, category: "ai-security", detectedAt: hoursAgo(1), evidence: "ScanFort red-team run: 9/12 injection payloads succeeded against the unprotected endpoint" },
  { id: 13, title: "Wildcard certificate reused across low-trust subdomains", description: "The same wildcard cert is deployed on staging and dev hosts, widening blast radius on key compromise.", severity: "low", status: "accepted", assetId: 10, category: "certificate", detectedAt: hoursAgo(12), evidence: "SAN list includes *.demo-org.com covering all subdomains" },
  { id: 14, title: "Decommissioned IP still resolves in stale DNS record", description: "203.0.113.25 was decommissioned but a legacy A record remains, inviting takeover risk.", severity: "informational", status: "resolved", assetId: 9, category: "dns-hygiene", detectedAt: daysAgo(40), evidence: "dig A record present; host no longer responds to TCP/443" },
  { id: 15, title: "SPF record allows overly broad sending sources", description: "The SPF record includes an \"all\" softfail rather than a hard fail, weakening spoof protection.", severity: "low", status: "open", assetId: 5, category: "email-security", detectedAt: hoursAgo(6), evidence: "DNS TXT: v=spf1 include:_spf.demo-org.com ~all" },
];

export const runs = [
  { id: 1, organization: ORG, target: "demo-org.com", status: "completed", startedAt: daysAgo(6), completedAt: daysAgo(6), assetCount: 18, findingCount: 12, durationSeconds: 184 },
  { id: 2, organization: ORG, target: "demo-org.com", status: "completed", startedAt: daysAgo(2), completedAt: daysAgo(2), assetCount: 19, findingCount: 14, durationSeconds: 201 },
  { id: 3, organization: ORG, target: "demo-org.com", status: "completed", startedAt: hoursAgo(9), completedAt: hoursAgo(9), assetCount: 20, findingCount: 15, durationSeconds: 176 },
];

export let nextIds = { asset: 21, finding: 16, run: 4 };
