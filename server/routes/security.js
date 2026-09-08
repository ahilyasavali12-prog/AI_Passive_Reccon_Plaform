import { Router } from "express";
import * as guardfort from "../security/guardfort.js";
import * as scanfort from "../security/scanfort.js";
import * as ollama from "../llm/ollama.js";

const router = Router();

router.get("/llm/status", async (_req, res) => {
  res.json(await ollama.status());
});

router.post("/guardfort/analyze", (req, res) => {
  const { text } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  res.json(guardfort.analyzeInbound(text));
});

router.post("/guardfort/chat", async (req, res) => {
  const { message } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const inbound = guardfort.analyzeInbound(message);
  if (inbound.blocked) {
    return res.json({
      blocked: true,
      stage: "inbound",
      risk: inbound.risk,
      reasons: inbound.reasons,
      redactions: inbound.redactions,
      sanitizedInput: inbound.sanitizedText,
    });
  }

  try {
    const raw = await ollama.generate(inbound.sanitizedText, { numPredict: 250 });
    const outbound = guardfort.analyzeOutbound(raw);
    res.json({
      blocked: false,
      input: {
        original: message,
        sanitized: inbound.sanitizedText,
        redactions: inbound.redactions,
        injectionRisk: inbound.risk,
        injectionScore: inbound.riskScore,
        injectionReasons: inbound.reasons,
      },
      output: {
        raw,
        sanitized: outbound.sanitizedText,
        redactions: outbound.redactions,
      },
      model: ollama.OLLAMA_MODEL,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/scanfort/tests", (_req, res) => {
  res.json(
    scanfort.TEST_SUITE.map(({ id, name, category, prompt }) => ({ id, name, category, prompt })),
  );
});

router.post("/scanfort/run", async (_req, res) => {
  try {
    const report = await scanfort.runSuite();
    res.json(report);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
