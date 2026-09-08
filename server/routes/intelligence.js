import { Router } from "express";
import * as store from "../data/store.js";
import { runPassiveRecon } from "../recon/pipeline.js";

const router = Router();

function normalizeTarget(input) {
  let t = String(input).trim().toLowerCase();
  t = t.replace(/^[a-z]+:\/\//, "");
  t = t.split("/")[0].split("?")[0].split("#")[0];
  t = t.split(":")[0];
  return t;
}

const HOSTNAME_RE = /^(?=.{1,253}$)[a-z0-9](-*[a-z0-9])*(\.[a-z0-9](-*[a-z0-9])*)+$/;

router.get("/dashboard/summary", (_req, res) => {
  res.json(store.dashboardSummary());
});

router.get("/dashboard/activity", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  res.json(store.dashboardActivity(limit));
});

router.get("/assets", (req, res) => {
  const { search, type, status } = req.query;
  res.json(store.listAssets({ search, type, status }));
});

router.get("/assets/:id", (req, res) => {
  const asset = store.getAsset(Number(req.params.id));
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  res.json(asset);
});

router.get("/findings", (req, res) => {
  const { severity, status, search } = req.query;
  const findings = store.listFindings({ severity, status, search });
  res.json(findings.map((f) => ({ ...f, assetName: store.assetName(f.assetId) })));
});

router.get("/findings/:id", (req, res) => {
  const finding = store.getFinding(Number(req.params.id));
  if (!finding) return res.status(404).json({ error: "Finding not found" });
  res.json({ ...finding, assetName: store.assetName(finding.assetId) });
});

const VALID_STATUSES = new Set(["open", "investigating", "accepted", "resolved"]);

router.patch("/findings/:id", (req, res) => {
  const { status } = req.body ?? {};
  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const updated = store.updateFindingStatus(Number(req.params.id), status);
  if (!updated) return res.status(404).json({ error: "Finding not found" });
  res.json({ ...updated, assetName: store.assetName(updated.assetId) });
});

router.get("/runs", (_req, res) => {
  res.json(store.listRuns());
});

router.post("/runs", async (req, res) => {
  const { organization, target: rawTarget } = req.body ?? {};
  if (!organization || !rawTarget) {
    return res.status(400).json({ error: "organization and target are required" });
  }
  const target = normalizeTarget(rawTarget);
  if (!HOSTNAME_RE.test(target)) {
    return res.status(400).json({ error: `"${rawTarget}" doesn't look like a valid domain (e.g. example.com)` });
  }

  const startedAt = new Date();
  try {
    const recon = await runPassiveRecon(target, organization);

    let assetCount = 0;
    let findingCount = 0;
    for (const entry of recon.entries) {
      const asset = store.addAsset(entry.asset);
      assetCount++;
      for (const finding of entry.findings) {
        store.addFinding({ ...finding, assetId: asset.id });
        findingCount++;
      }
    }

    const completedAt = new Date();
    const run = store.recordRun({
      organization,
      target,
      status: "completed",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      assetCount,
      findingCount,
      durationSeconds: Math.round((completedAt - startedAt) / 1000),
    });

    res.status(202).json({
      ...run,
      notes: recon.notes,
      subdomainsFound: recon.subdomainSource.subdomains.length,
    });
  } catch (err) {
    const completedAt = new Date();
    const run = store.recordRun({
      organization,
      target,
      status: "failed",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      assetCount: 0,
      findingCount: 0,
      durationSeconds: Math.round((completedAt - startedAt) / 1000),
    });
    res.status(502).json({ error: err.message, run });
  }
});

export default router;
