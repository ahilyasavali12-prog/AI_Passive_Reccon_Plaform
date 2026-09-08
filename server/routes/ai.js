import { Router } from "express";
import * as store from "../data/store.js";
import * as triage from "../ai/triage.js";
import * as report from "../ai/report.js";

const router = Router();

router.post("/ai/triage/asset/:id", async (req, res) => {
  const asset = store.getAsset(Number(req.params.id));
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  const findings = store.listFindings({}).filter((f) => f.assetId === asset.id);
  try {
    const result = await triage.triageAsset(asset, findings);
    res.json({ assetId: asset.id, assetName: asset.name, ...result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/ai/report", async (_req, res) => {
  try {
    const summary = store.dashboardSummary();
    const assets = store.listAssets({});
    const findings = store.listFindings({}).map((f) => ({ ...f, assetName: store.assetName(f.assetId) }));
    const runs = store.listRuns();
    const result = await report.generateReport({ summary, assets, findings, runs });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
