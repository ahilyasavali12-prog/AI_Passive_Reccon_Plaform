import { assets as seedAssets, findings as seedFindings, runs as seedRuns } from "./seed.js";

// In-memory store, seeded on boot. No external DB required for the local demo.
const state = {
  assets: seedAssets.map((a) => ({ ...a })),
  findings: seedFindings.map((f) => ({ ...f })),
  runs: seedRuns.map((r) => ({ ...r })),
  nextRunId: seedRuns.length + 1,
  nextAssetId: seedAssets.length + 1,
  nextFindingId: seedFindings.length + 1,
};

export function addAsset(data) {
  const asset = { id: state.nextAssetId++, ...data };
  state.assets.push(asset);
  return asset;
}

export function addFinding(data) {
  const finding = { id: state.nextFindingId++, status: "open", detectedAt: new Date().toISOString(), ...data };
  state.findings.push(finding);
  return finding;
}

export function listAssets({ search, type, status } = {}) {
  return state.assets.filter((asset) => {
    if (type && asset.type !== type) return false;
    if (status && asset.status !== status) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!asset.name.toLowerCase().includes(q) && !asset.organization.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.riskScore - a.riskScore);
}

export function getAsset(id) {
  return state.assets.find((a) => a.id === id) ?? null;
}

export function listFindings({ severity, status, search } = {}) {
  return state.findings.filter((finding) => {
    if (severity && finding.severity !== severity) return false;
    if (status && finding.status !== status) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !finding.title.toLowerCase().includes(q) &&
        !finding.description.toLowerCase().includes(q) &&
        !finding.category.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  }).sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
}

export function getFinding(id) {
  return state.findings.find((f) => f.id === id) ?? null;
}

export function updateFindingStatus(id, status) {
  const finding = getFinding(id);
  if (!finding) return null;
  finding.status = status;
  return finding;
}

export function assetName(assetId) {
  return getAsset(assetId)?.name ?? "Unknown asset";
}

export function listRuns() {
  return [...state.runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export function recordRun({ organization, target, status, startedAt, completedAt, assetCount, findingCount, durationSeconds }) {
  const run = {
    id: state.nextRunId++,
    organization,
    target,
    status,
    startedAt,
    completedAt,
    assetCount,
    findingCount,
    durationSeconds,
  };
  state.runs.push(run);
  return run;
}

export function dashboardSummary() {
  const { assets, findings, runs } = state;
  const assetsByType = {};
  for (const a of assets) assetsByType[a.type] = (assetsByType[a.type] ?? 0) + 1;
  const findingsBySeverity = {};
  for (const f of findings) findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] ?? 0) + 1;
  const openFindings = findings.filter((f) => f.status === "open" || f.status === "investigating");
  const riskScore = assets.length ? Math.round(assets.reduce((t, a) => t + a.riskScore, 0) / assets.length) : 0;
  const lastRun = [...runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];

  return {
    totalAssets: assets.length,
    activeAssets: assets.filter((a) => a.status === "active").length,
    openFindings: openFindings.length,
    criticalFindings: findings.filter((f) => f.severity === "critical").length,
    highFindings: findings.filter((f) => f.severity === "high").length,
    riskScore,
    lastRunAt: lastRun ? lastRun.startedAt : null,
    assetsByType,
    findingsBySeverity,
  };
}

export function dashboardActivity(limit = 8) {
  const { runs, findings, assets } = state;
  const activity = [
    ...runs.map((run) => ({
      id: `run-${run.id}`,
      kind: "run",
      title: `Recon run ${run.status}`,
      detail: `${run.target} · ${run.assetCount} assets · ${run.findingCount} findings`,
      timestamp: run.startedAt,
      severity: null,
    })),
    ...findings.map((finding) => ({
      id: `finding-${finding.id}`,
      kind: "finding",
      title: finding.title,
      detail: `${finding.category} finding detected`,
      timestamp: finding.detectedAt,
      severity: finding.severity,
    })),
    ...assets.map((asset) => ({
      id: `asset-${asset.id}`,
      kind: "asset",
      title: `Asset observed: ${asset.name}`,
      detail: `${asset.type} · risk score ${asset.riskScore}`,
      timestamp: asset.lastSeen,
      severity: null,
    })),
  ]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, limit);

  return activity;
}
