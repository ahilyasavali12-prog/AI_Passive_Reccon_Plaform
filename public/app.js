const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

async function api(path, opts) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Tabs ----------
$$(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab-btn").forEach((b) => b.classList.remove("active"));
    $$(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    $(`#view-${btn.dataset.view}`).classList.add("active");
  });
});

// ---------- LLM status ----------
async function refreshLlmStatus() {
  const dot = $("#llm-dot");
  const text = $("#llm-status-text");
  try {
    const s = await api("/llm/status");
    if (s.reachable) {
      dot.className = "dot on";
      text.textContent = s.modelAvailable
        ? `Ollama online · ${s.model}`
        : `Ollama online · pull "${s.model}" (ollama pull ${s.model})`;
    } else {
      dot.className = "dot off";
      text.textContent = "Ollama unreachable · run `ollama serve`";
    }
  } catch {
    dot.className = "dot off";
    text.textContent = "LLM status unavailable";
  }
}

// ---------- Overview ----------
async function loadOverview() {
  const summary = await api("/dashboard/summary");
  const cards = [
    { label: "Total assets", value: summary.totalAssets, sub: `${summary.activeAssets} active` },
    { label: "Open findings", value: summary.openFindings, sub: `${summary.criticalFindings} critical · ${summary.highFindings} high` },
    { label: "Avg risk score", value: summary.riskScore, sub: "0-100 scale" },
    { label: "Last recon run", value: summary.lastRunAt ? fmtTime(summary.lastRunAt) : "—", sub: "passive pipeline" },
  ];
  $("#summary-cards").innerHTML = cards
    .map((c) => `<div class="card"><h3>${c.label}</h3><div class="stat">${c.value}</div><div class="sub">${c.sub}</div></div>`)
    .join("");

  const typeTotal = Object.values(summary.assetsByType).reduce((a, b) => a + b, 0) || 1;
  $("#assets-by-type").innerHTML = Object.entries(summary.assetsByType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => barRow(type, count, typeTotal))
    .join("") || `<div class="empty">No assets yet</div>`;

  const sevOrder = ["critical", "high", "medium", "low", "informational"];
  const sevTotal = Object.values(summary.findingsBySeverity).reduce((a, b) => a + b, 0) || 1;
  $("#findings-by-severity").innerHTML = sevOrder
    .filter((s) => summary.findingsBySeverity[s])
    .map((s) => barRow(s, summary.findingsBySeverity[s], sevTotal))
    .join("") || `<div class="empty">No findings yet</div>`;

  const activity = await api("/dashboard/activity?limit=10");
  $("#activity-list").innerHTML = activity.length
    ? activity
        .map(
          (a) => `<div class="activity-item">
            <div>
              <div class="title">${escapeHtml(a.title)} ${a.severity ? `<span class="badge ${a.severity}">${a.severity}</span>` : ""}</div>
              <div class="detail">${escapeHtml(a.detail)}</div>
            </div>
            <div class="time">${fmtTime(a.timestamp)}</div>
          </div>`,
        )
        .join("")
    : `<div class="empty">No activity yet</div>`;
}

function barRow(label, count, total) {
  const pct = Math.round((count / total) * 100);
  return `<div class="bar-row">
    <div class="label">${escapeHtml(label)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
    <div class="count">${count}</div>
  </div>`;
}

// ---------- Passive Recon Scan ----------
$("#scan-run").addEventListener("click", async () => {
  const target = $("#scan-target").value.trim();
  const organization = $("#scan-org").value.trim() || target;
  const progress = $("#scan-progress");
  if (!target) {
    progress.innerHTML = `<span style="color: var(--critical)">Enter a target domain first.</span>`;
    return;
  }
  const btn = $("#scan-run");
  btn.disabled = true;
  btn.textContent = "Scanning…";
  progress.textContent = `Resolving DNS, enumerating subdomains, and fingerprinting live hosts for ${target}… usually 5-15 seconds, can take up to ~1 minute.`;
  try {
    const run = await api("/runs", { method: "POST", body: JSON.stringify({ organization, target }) });
    progress.innerHTML = `Done — found <strong>${run.assetCount}</strong> asset(s) and <strong>${run.findingCount}</strong> finding(s) for <strong>${escapeHtml(run.target)}</strong> (${run.subdomainsFound} subdomain(s) via certificate transparency). ${run.notes?.length ? `<br><span style="color: var(--medium)">${run.notes.map(escapeHtml).join("<br>")}</span>` : ""}`;
    await Promise.all([loadOverview(), loadAssets(), loadFindings()]);
  } catch (err) {
    progress.innerHTML = `<span style="color: var(--critical)">⚠️ ${escapeHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Passive Recon";
  }
});

// ---------- Assets ----------
async function loadAssets() {
  const search = $("#asset-search").value.trim();
  const type = $("#asset-type-filter").value;
  const status = $("#asset-status-filter").value;
  const qs = new URLSearchParams({ ...(search && { search }), ...(type && { type }), ...(status && { status }) });
  const assets = await api(`/assets?${qs.toString()}`);
  $("#assets-table-body").innerHTML = assets.length
    ? assets
        .map(
          (a) => `<tr>
            <td>${escapeHtml(a.name)}</td>
            <td>${a.type}</td>
            <td><span class="badge ${a.status}">${a.status}</span></td>
            <td>${a.riskScore}</td>
            <td>${fmtTime(a.lastSeen)}</td>
            <td><button class="btn ghost triage-btn" data-asset-id="${a.id}">Triage</button></td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" class="empty">No matching assets</td></tr>`;

  $$(".triage-btn").forEach((btn) =>
    btn.addEventListener("click", () => runTriage(Number(btn.dataset.assetId), btn)),
  );
}
["asset-search", "asset-type-filter", "asset-status-filter"].forEach((id) =>
  $(`#${id}`).addEventListener("input", loadAssets),
);

async function runTriage(assetId, btn) {
  const panel = $("#triage-result");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Triaging…";
  panel.innerHTML = `<div class="empty">Asking the local LLM to triage this asset…</div>`;
  try {
    const result = await api(`/ai/triage/asset/${assetId}`, { method: "POST" });
    panel.innerHTML = `
      <div class="row">
        <h4>AI triage — ${escapeHtml(result.assetName)}</h4>
        <div class="content"><span class="badge ${result.priority.startsWith("P1") ? "critical" : result.priority.startsWith("P2") ? "high" : result.priority.startsWith("P3") ? "medium" : "low"}">${escapeHtml(result.priority)}</span></div>
      </div>
      <div class="row">
        <h4>Business impact</h4>
        <div class="content">${escapeHtml(result.businessImpact)}</div>
      </div>
      <div class="row">
        <h4>Recommended action</h4>
        <div class="content">${escapeHtml(result.recommendedAction)}</div>
      </div>`;
  } catch (err) {
    panel.innerHTML = `<div class="blocked-banner">⚠️ ${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

// ---------- Findings ----------
async function loadFindings() {
  const search = $("#finding-search").value.trim();
  const severity = $("#finding-severity-filter").value;
  const status = $("#finding-status-filter").value;
  const qs = new URLSearchParams({ ...(search && { search }), ...(severity && { severity }), ...(status && { status }) });
  const findings = await api(`/findings?${qs.toString()}`);
  $("#findings-table-body").innerHTML = findings.length
    ? findings
        .map(
          (f) => `<tr>
            <td>${escapeHtml(f.title)}</td>
            <td>${escapeHtml(f.assetName)}</td>
            <td><span class="badge ${f.severity}">${f.severity}</span></td>
            <td>
              <select class="finding-status-select" data-id="${f.id}">
                ${["open", "investigating", "accepted", "resolved"]
                  .map((s) => `<option value="${s}" ${s === f.status ? "selected" : ""}>${s}</option>`)
                  .join("")}
              </select>
            </td>
            <td>${fmtTime(f.detectedAt)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="empty">No matching findings</td></tr>`;

  $$(".finding-status-select").forEach((sel) =>
    sel.addEventListener("change", async () => {
      await api(`/findings/${sel.dataset.id}`, { method: "PATCH", body: JSON.stringify({ status: sel.value }) });
      loadOverview();
    }),
  );
}
["finding-search", "finding-severity-filter", "finding-status-filter"].forEach((id) =>
  $(`#${id}`).addEventListener("input", loadFindings),
);

// ---------- VAPT Report ----------
$("#report-generate").addEventListener("click", async () => {
  const btn = $("#report-generate");
  btn.disabled = true;
  btn.textContent = "Generating… (drafting summary + remediation plan)";
  $("#report-progress").textContent = "Asking the local LLM for the executive summary and remediation plan…";
  $("#report-download").style.display = "none";
  $("#report-download-docx").style.display = "none";
  $("#report-output-wrap").style.display = "none";
  try {
    const result = await api("/ai/report", { method: "POST" });
    $("#report-output").textContent = result.markdown;
    $("#report-output-wrap").style.display = "";
    $("#report-progress").textContent = `Generated ${fmtTime(result.generatedAt)}`;
    $("#report-download").style.display = "";
    $("#report-download").onclick = () => downloadBlob("vapt-report.md", new Blob([result.markdown], { type: "text/markdown" }));
    $("#report-download-docx").style.display = "";
    $("#report-download-docx").onclick = () => downloadDocxReport(result);
  } catch (err) {
    $("#report-progress").innerHTML = `<span style="color: var(--critical)">⚠️ ${escapeHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate VAPT Report (AI)";
  }
});

async function downloadDocxReport(result) {
  const docxBtn = $("#report-download-docx");
  const original = docxBtn.textContent;
  docxBtn.disabled = true;
  docxBtn.textContent = "Building .docx…";
  try {
    const res = await fetch("/api/ai/report/docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        execSummary: result.execSummary,
        recommendations: result.recommendations,
        generatedAt: result.generatedAt,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    const blob = await res.blob();
    downloadBlob("vapt-report.docx", blob);
  } catch (err) {
    $("#report-progress").innerHTML = `<span style="color: var(--critical)">⚠️ ${escapeHtml(err.message)}</span>`;
  } finally {
    docxBtn.disabled = false;
    docxBtn.textContent = original;
  }
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- GuardFort ----------
function redactionChips(redactions) {
  if (!redactions?.length) return `<span style="color: var(--text-dim); font-size:12px;">none detected</span>`;
  return redactions.map((r) => `<span class="redaction-chip">${r.type}</span>`).join("");
}

function renderGuardfortResult(data) {
  const box = $("#guardfort-result");
  if (data.blocked) {
    box.innerHTML = `<div class="blocked-banner">🚫 Blocked at the firewall — injection risk "${data.risk}" (signals: ${data.reasons.join(", ") || "n/a"}). This request never reached the LLM.</div>
      <div class="row"><h4>PII redactions found in the blocked input</h4><div class="content">${redactionChips(data.redactions)}</div></div>`;
    return;
  }
  if (data.error) {
    box.innerHTML = `<div class="blocked-banner">⚠️ ${escapeHtml(data.error)}</div>`;
    return;
  }
  box.innerHTML = `
    <div class="row">
      <h4>Injection risk (inbound)</h4>
      <div class="content"><span class="badge ${data.input.injectionRisk === "none" ? "safe" : data.input.injectionRisk}">${data.input.injectionRisk}</span> score ${data.input.injectionScore} — ${data.input.injectionReasons.join(", ") || "no signals"}</div>
    </div>
    <div class="row">
      <h4>PII redacted from input before it reached the LLM</h4>
      <div class="content">${redactionChips(data.input.redactions)}</div>
    </div>
    <div class="row">
      <h4>Sanitized input sent to ${escapeHtml(data.model)}</h4>
      <div class="content">${escapeHtml(data.input.sanitized)}</div>
    </div>
    <div class="row">
      <h4>Model response (after outbound PII scan)</h4>
      <div class="content">${escapeHtml(data.output.sanitized)}</div>
    </div>
    <div class="row">
      <h4>PII redacted from the model's response</h4>
      <div class="content">${redactionChips(data.output.redactions)}</div>
    </div>`;
}

$("#guardfort-send").addEventListener("click", async () => {
  const message = $("#guardfort-input").value.trim();
  if (!message) return;
  const btn = $("#guardfort-send");
  btn.disabled = true;
  btn.textContent = "Sending…";
  $("#guardfort-result").innerHTML = `<div class="empty">Analyzing and querying the local LLM…</div>`;
  try {
    const data = await api("/guardfort/chat", { method: "POST", body: JSON.stringify({ message }) });
    renderGuardfortResult(data);
  } catch (err) {
    renderGuardfortResult({ error: err.message });
  } finally {
    btn.disabled = false;
    btn.textContent = "Send through GuardFort → LLM";
  }
});

$("#guardfort-analyze-only").addEventListener("click", async () => {
  const text = $("#guardfort-input").value.trim();
  if (!text) return;
  try {
    const data = await api("/guardfort/analyze", { method: "POST", body: JSON.stringify({ text }) });
    $("#guardfort-result").innerHTML = `
      <div class="row">
        <h4>Injection risk</h4>
        <div class="content"><span class="badge ${data.risk === "none" ? "safe" : data.risk}">${data.risk}</span> score ${data.riskScore} — ${data.reasons.join(", ") || "no signals"} ${data.blocked ? "· would be BLOCKED before reaching the LLM" : ""}</div>
      </div>
      <div class="row">
        <h4>PII detected</h4>
        <div class="content">${redactionChips(data.redactions)}</div>
      </div>
      <div class="row">
        <h4>Sanitized text</h4>
        <div class="content">${escapeHtml(data.sanitizedText)}</div>
      </div>`;
  } catch (err) {
    $("#guardfort-result").innerHTML = `<div class="blocked-banner">⚠️ ${escapeHtml(err.message)}</div>`;
  }
});

// ---------- ScanFort ----------
function outcomeBadge(outcome, extra) {
  if (extra?.blockedByGuardFort) return `<span class="badge blocked">blocked</span>`;
  const cls = outcome === "vulnerable" ? "vulnerable" : outcome === "safe" ? "safe" : "inconclusive";
  return `<span class="badge ${cls}">${outcome}</span>`;
}

$("#scanfort-run").addEventListener("click", async () => {
  const btn = $("#scanfort-run");
  btn.disabled = true;
  btn.textContent = "Running suite… (this can take a minute on CPU)";
  $("#scanfort-progress").textContent = "Sending 12 payloads to the local LLM, baseline + protected…";
  $("#scanfort-summary").innerHTML = "";
  $("#scanfort-results-wrap").style.display = "none";
  try {
    const report = await api("/scanfort/run", { method: "POST" });
    renderScanfortReport(report);
  } catch (err) {
    $("#scanfort-progress").innerHTML = `<span style="color: var(--critical)">⚠️ ${escapeHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Red-Team Scan (12 payloads)";
  }
});

function renderScanfortReport(report) {
  const { summary, results } = report;
  $("#scanfort-progress").textContent = `Last run: ${fmtTime(report.ranAt)}`;
  $("#scanfort-summary").innerHTML = `
    <div class="scan-summary">
      <div class="card"><h3>Baseline vulnerable</h3><div class="stat" style="color:var(--critical)">${summary.baselineVulnerable}/${summary.total}</div><div class="sub">unprotected LLM</div></div>
      <div class="card"><h3>Protected vulnerable</h3><div class="stat" style="color:${summary.protectedVulnerable ? "var(--critical)" : "var(--low)"}">${summary.protectedVulnerable}/${summary.total}</div><div class="sub">behind GuardFort</div></div>
      <div class="card"><h3>Blocked pre-LLM</h3><div class="stat" style="color:var(--accent)">${summary.protectedBlocked}/${summary.total}</div><div class="sub">GuardFort firewall</div></div>
      <div class="card"><h3>Risk reduction</h3><div class="stat">${summary.baselineVulnerable ? Math.round((1 - summary.protectedVulnerable / summary.baselineVulnerable) * 100) : 0}%</div><div class="sub">fewer successful injections</div></div>
    </div>`;
  $("#scanfort-results-wrap").style.display = "";
  $("#scanfort-table-body").innerHTML = results
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${r.category}</td>
        <td>${outcomeBadge(r.baseline.outcome)}</td>
        <td>${outcomeBadge(r.protected.outcome, r.protected)}</td>
      </tr>`,
    )
    .join("");
}

// ---------- Init ----------
refreshLlmStatus();
setInterval(refreshLlmStatus, 15000);
loadOverview();
loadAssets();
loadFindings();
