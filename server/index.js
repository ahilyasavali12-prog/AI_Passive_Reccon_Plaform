import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import intelligenceRoutes from "./routes/intelligence.js";
import securityRoutes from "./routes/security.js";
import aiRoutes from "./routes/ai.js";
import * as ollama from "./llm/ollama.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));
app.use("/api", intelligenceRoutes);
app.use("/api", securityRoutes);
app.use("/api", aiRoutes);

app.use(express.static(path.join(__dirname, "..", "public")));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Attack Surface Intelligence platform (AI triage, VAPT reporting, GuardFort/ScanFort) running at http://localhost:${PORT}`);

  ollama.status().then((s) => {
    if (!s.reachable) {
      console.log("Ollama not reachable yet — LLM features will retry when you use them.");
      return;
    }
    console.log(`Warming up ${ollama.OLLAMA_MODEL} in the background so the first click isn't slow…`);
    ollama.warmup().then((ok) => {
      console.log(ok ? `${ollama.OLLAMA_MODEL} is warm and ready.` : `Warmup of ${ollama.OLLAMA_MODEL} failed — first real request may be slow.`);
    });
  });
});
