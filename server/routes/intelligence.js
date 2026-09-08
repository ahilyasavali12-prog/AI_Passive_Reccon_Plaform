import { Router } from "express";
import * as store from "../data/store.js";

const router = Router();

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

router.post("/runs", (req, res) => {
  const { organization, target } = req.body ?? {};
  if (!organization || !target) {
    return res.status(400).json({ error: "organization and target are required" });
  }
  const run = store.createRun({ organization, target });
  res.status(202).json(run);
});

export default router;
