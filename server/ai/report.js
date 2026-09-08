// AI-assisted VAPT reporting: the LLM drafts the narrative sections
// (executive summary, remediation plan) while the findings/asset tables and
// evidence appendix are rendered deterministically straight from the actual
// data — so nothing in the tables can be hallucinated, only the prose.

import * as ollama from "../llm/ollama.js";
import * as guardfort from "../security/guardfort.js";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "informational"];

function buildExecSummaryPrompt(summary, topFindings) {
  return `You are a security analyst assistant. Write a concise executive summary (3-5 sentences, plain prose, no headers, no bullet points) for a Vulnerability Assessment and Penetration Testing report, based on this data:

Total assets: ${summary.totalAssets} (${summary.activeAssets} active)
Open findings: ${summary.openFindings} (${summary.criticalFindings} critical, ${summary.highFindings} high)
Average risk score: ${summary.riskScore}/100

Top findings:
${topFindings.map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title} — ${f.description}`).join("\n") || "none"}

Write only the executive summary paragraph, addressed to technical leadership. Do not include a title.`;
}

function buildRecommendationsPrompt(openFindings) {
  return `You are a security analyst assistant. Given these open findings from a VAPT engagement, write a prioritized remediation plan as a numbered list (max 6 items, one line each, action-oriented, ordered by risk and effort, referencing each finding's category).

Findings:
${openFindings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title} (${f.category})`).join("\n") || "none"}

Output only the numbered list, nothing else.`;
}

function assetNameOf(assets, id) {
  return assets.find((a) => a.id === id)?.name ?? "Unknown asset";
}

function renderMarkdown({ summary, assets, findings, execSummary, recommendations, generatedAt }) {
  const sortedFindings = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  const findingsRows = sortedFindings
    .map((f) => `| ${f.severity.toUpperCase()} | ${f.title} | ${assetNameOf(assets, f.assetId)} | ${f.status} | ${f.category} |`)
    .join("\n");

  const assetRows = [...assets]
    .sort((a, b) => b.riskScore - a.riskScore)
    .map((a) => `| ${a.name} | ${a.type} | ${a.status} | ${a.riskScore} |`)
    .join("\n");

  const evidence = sortedFindings
    .map((f) => `### ${f.title}\n**Severity:** ${f.severity} · **Asset:** ${assetNameOf(assets, f.assetId)}\n\n${f.evidence}`)
    .join("\n\n");

  return `# Vulnerability Assessment & Penetration Testing Report

**Organization:** ${assets[0]?.organization ?? "target organization"}
**Generated:** ${new Date(generatedAt).toLocaleString()}
**Scope:** Passive reconnaissance across all internet-facing assets discovered for the target organization.
**Methodology:** Automated passive asset discovery, service/technology fingerprinting, and rule-based + AI-assisted finding triage. No active exploitation was performed.

## Executive Summary

${execSummary}

## Risk Overview

| Metric | Value |
|---|---|
| Total assets | ${summary.totalAssets} |
| Active assets | ${summary.activeAssets} |
| Open findings | ${summary.openFindings} |
| Critical findings | ${summary.criticalFindings} |
| High findings | ${summary.highFindings} |
| Average risk score | ${summary.riskScore}/100 |

## Findings

| Severity | Finding | Asset | Status | Category |
|---|---|---|---|---|
${findingsRows}

## Asset Inventory

| Asset | Type | Status | Risk score |
|---|---|---|---|
${assetRows}

## Recommended Remediation Plan

${recommendations}

## Evidence Appendix

${evidence}

---
*Narrative sections (Executive Summary, Recommended Remediation Plan) were drafted with local LLM assistance and passed through the platform's outbound PII filter. All tables above are generated directly from recorded findings data. Review before external distribution.*
`;
}

export async function generateReport({ summary, assets, findings, runs }) {
  const topFindings = findings.filter((f) => f.severity === "critical" || f.severity === "high").slice(0, 6);
  const openFindings = findings.filter((f) => f.status === "open" || f.status === "investigating");

  const [execRaw, recRaw] = await Promise.all([
    ollama.generate(buildExecSummaryPrompt(summary, topFindings), { temperature: 0.3, numPredict: 220 }),
    ollama.generate(buildRecommendationsPrompt(openFindings), { temperature: 0.3, numPredict: 260 }),
  ]);

  const execSummary = guardfort.analyzeOutbound(execRaw).sanitizedText.trim();
  const recommendations = guardfort.analyzeOutbound(recRaw).sanitizedText.trim();
  const generatedAt = new Date().toISOString();

  const markdown = renderMarkdown({ summary, assets, findings, execSummary, recommendations, generatedAt });
  return { markdown, execSummary, recommendations, generatedAt, lastRun: runs[0] ?? null };
}
