// Builds the same VAPT report as report.js's Markdown, as a real .docx —
// real Word tables/headings, not markdown pipes. Takes the already-generated
// LLM narrative (execSummary/recommendations) so this never calls the LLM
// itself; the tables/appendix are built directly from store data, same as
// the Markdown version, so both outputs always agree.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, LevelFormat,
} from "docx";

const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = 1440;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;

const SEVERITY_COLORS = {
  CRITICAL: { fill: "F8D7DA", text: "842029" },
  HIGH: { fill: "FFE5CC", text: "9C4A00" },
  MEDIUM: { fill: "FFF3CD", text: "806600" },
  LOW: { fill: "D4EDDA", text: "1E7A34" },
  INFORMATIONAL: { fill: "D6E9F9", text: "31708F" },
};

function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: "2B2F38" },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })] })],
  });
}

function bodyCell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text), size: 18, bold: !!opts.bold, color: opts.color || "1A1A1A" })],
      }),
    ],
  });
}

function makeTable(headers, widths, rows, { severityCol = -1 } = {}) {
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, widths[i])) });
  const dataRows = rows.map((row) => {
    const sevKey = severityCol >= 0 ? String(row[severityCol]).toUpperCase() : null;
    const sevColor = sevKey ? SEVERITY_COLORS[sevKey] : null;
    return new TableRow({
      children: row.map((cell, i) =>
        i === severityCol && sevColor
          ? bodyCell(cell, widths[i], { fill: sevColor.fill, color: sevColor.text, bold: true })
          : bodyCell(cell, widths[i]),
      ),
    });
  });
  return new Table({ width: { size: USABLE_WIDTH, type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...dataRows] });
}

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 } });
}
function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 } });
}
function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 160, line: 300 },
    children: [new TextRun({ text, size: 21, italics: !!opts.italics, color: opts.color })],
  });
}
function labelValue(label, value) {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: `${label}: `, bold: true, size: 20 }), new TextRun({ text: String(value), size: 20 })],
  });
}
function divider() {
  return new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D0D3D8" } }, spacing: { before: 100, after: 200 } });
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "informational"];

function assetNameOf(assets, id) {
  return assets.find((a) => a.id === id)?.name ?? "Unknown asset";
}

function parseRemediationLine(line) {
  // "1. [HIGH] Title (category) — action" -> pull out severity/title/category/action if present
  const m = line.match(/^\s*\d+\.\s*\[([A-Z]+)\]\s*([^(]+?)\s*\(([^)]+)\)\s*[-–—]\s*(.+)$/);
  if (m) return { severity: m[1], title: m[2].trim(), category: m[3].trim(), action: m[4].trim() };
  return { severity: null, title: line.replace(/^\s*\d+\.\s*/, ""), category: null, action: null };
}

export async function buildDocxReport({ summary, assets, findings, execSummary, recommendations, generatedAt }) {
  const org = assets[0]?.organization ?? "target organization";
  const sortedFindings = [...findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

  const children = [];

  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "Vulnerability Assessment &", bold: true, size: 40 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 260 }, children: [new TextRun({ text: "Penetration Testing Report", bold: true, size: 40 })] }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "2B2F38" } }, spacing: { after: 240 } }),
    labelValue("Organization", org),
    labelValue("Generated", new Date(generatedAt).toLocaleString()),
    labelValue("Scope", "Passive reconnaissance across all internet-facing assets discovered for the target organization."),
    labelValue("Methodology", "Automated passive asset discovery, service/technology fingerprinting, and rule-based + AI-assisted finding triage. No active exploitation was performed."),
    divider(),
  );

  children.push(h1("Executive Summary"), body(execSummary));

  children.push(
    h1("Risk Overview"),
    makeTable(
      ["Metric", "Value"],
      [4680, 4680],
      [
        ["Total assets", String(summary.totalAssets)],
        ["Active assets", String(summary.activeAssets)],
        ["Open findings", String(summary.openFindings)],
        ["Critical findings", String(summary.criticalFindings)],
        ["High findings", String(summary.highFindings)],
        ["Average risk score", `${summary.riskScore} / 100`],
      ],
    ),
  );

  children.push(
    new Paragraph({ children: [], spacing: { after: 200 } }),
    h1("Findings"),
    makeTable(
      ["Severity", "Finding", "Asset", "Status", "Category"],
      [1200, 3000, 2400, 1200, 1560],
      sortedFindings.map((f) => [f.severity.toUpperCase(), f.title, assetNameOf(assets, f.assetId), f.status, f.category]),
      { severityCol: 0 },
    ),
  );

  children.push(
    new Paragraph({ children: [], spacing: { after: 200 } }),
    h1("Asset Inventory"),
    makeTable(
      ["Asset", "Type", "Status", "Risk Score"],
      [3600, 1800, 1800, 2160],
      [...assets].sort((a, b) => b.riskScore - a.riskScore).map((a) => [a.name, a.type, a.status, String(a.riskScore)]),
    ),
  );

  children.push(new Paragraph({ children: [], spacing: { after: 100 } }), h1("Recommended Remediation Plan"));
  const remediationLines = recommendations.split("\n").map((l) => l.trim()).filter(Boolean);
  remediationLines.forEach((line) => {
    const item = parseRemediationLine(line);
    const sev = item.severity ? SEVERITY_COLORS[item.severity] : null;
    const runs = [];
    if (item.severity && sev) runs.push(new TextRun({ text: `[${item.severity}] `, bold: true, color: sev.text, size: 20 }));
    runs.push(new TextRun({ text: item.title, bold: true, size: 20 }));
    if (item.category) runs.push(new TextRun({ text: ` (${item.category})`, italics: true, size: 20, color: "555555" }));
    if (item.action) runs.push(new TextRun({ text: ` — ${item.action}`, size: 20 }));
    children.push(new Paragraph({ numbering: { reference: "remediation-list", level: 0 }, spacing: { after: 140 }, children: runs }));
  });

  children.push(new Paragraph({ children: [], spacing: { after: 100 } }), h1("Evidence Appendix"));
  sortedFindings.forEach((f) => {
    const sev = SEVERITY_COLORS[f.severity.toUpperCase()];
    children.push(
      h2(f.title),
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Severity: ", bold: true, size: 19 }),
          new TextRun({ text: f.severity.toUpperCase(), bold: true, size: 19, color: sev?.text }),
          new TextRun({ text: "   ·   Asset: ", bold: true, size: 19 }),
          new TextRun({ text: assetNameOf(assets, f.assetId), size: 19 }),
        ],
      }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: f.evidence, size: 19, font: "Consolas", color: "3A3A3A" })] }),
    );
  });

  children.push(
    divider(),
    body(
      "Narrative sections (Executive Summary, Recommended Remediation Plan) were drafted with local LLM assistance and passed through the platform's outbound PII filter. All tables above are generated directly from recorded findings data. Review before external distribution.",
      { italics: true, color: "666666" },
    ),
  );

  const doc = new Document({
    numbering: {
      config: [{ reference: "remediation-list", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START }] }],
    },
    sections: [
      {
        properties: { page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
        children,
      },
    ],
    styles: { default: { document: { run: { font: "Calibri" } } } },
  });

  return Packer.toBuffer(doc);
}
