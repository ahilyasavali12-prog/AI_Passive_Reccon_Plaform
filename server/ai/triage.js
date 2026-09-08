// AI-assisted asset triage: turns a discovered asset + its findings into a
// prioritized, actionable recommendation using the local LLM. This is the
// automation core of the platform — passive recon finds things, this decides
// what matters and what to do about it.

import * as ollama from "../llm/ollama.js";
import * as guardfort from "../security/guardfort.js";

function buildTriagePrompt(asset, findings) {
  return `You are a security analyst assistant performing triage on a discovered internet-facing asset.

Asset: ${asset.name}
Type: ${asset.type}
Status: ${asset.status}
Automated risk score: ${asset.riskScore}/100

Findings on this asset:
${findings.length ? findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join("\n") : "- none recorded"}

Respond in exactly this format, one field per line, no extra commentary, no markdown:
PRIORITY: <one of P1-Immediate, P2-High, P3-Medium, P4-Low>
BUSINESS_IMPACT: <one sentence, plain language, for a non-technical stakeholder>
RECOMMENDED_ACTION: <one sentence, specific and actionable for the security team>`;
}

function parseTriage(text) {
  const get = (label) => {
    const m = text.match(new RegExp(`${label}:\\s*(.+)`, "i"));
    return m ? m[1].trim() : null;
  };
  return {
    priority: get("PRIORITY") ?? "Unclassified",
    businessImpact: get("BUSINESS_IMPACT") ?? text.trim(),
    recommendedAction: get("RECOMMENDED_ACTION") ?? "",
    raw: text.trim(),
  };
}

export async function triageAsset(asset, findings) {
  const raw = await ollama.generate(buildTriagePrompt(asset, findings), { temperature: 0.2, numPredict: 160 });
  const { sanitizedText } = guardfort.analyzeOutbound(raw);
  return parseTriage(sanitizedText);
}
