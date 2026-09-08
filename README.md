# Attack Surface Intelligence Platform (local demo)

A fully local platform where custom LLM/AI workflows automate the analyst's job end to
end: **passive recon → asset triage → VAPT reporting** — wrapped in AI-security guardrails
so the automation itself can't be used against you.

- **Live passive recon** — type a real domain into the Overview tab and it runs actual
  DNS resolution, certificate-transparency subdomain enumeration (via crt.sh — public CT
  logs, no API key), and a single lightweight HTTP(S) fingerprint request per discovered
  host. Purely passive: only public-data lookups and one unauthenticated request per
  host, nothing that touches the target beyond that. Results are scored heuristically and
  turned into real findings (missing HTTPS, disclosed server banners, missing security
  headers, sensitive-looking subdomain names) that flow straight into Assets/Findings.
- **AI asset triage** — the local LLM reads each discovered asset and its findings and
  returns a priority (P1–P4), a plain-language business impact statement, and a specific
  recommended action. Turns a raw asset list into a worked triage queue.
- **AI-drafted VAPT reporting** — one click drafts a full Vulnerability Assessment &
  Penetration Testing report: the LLM writes the executive summary and remediation plan,
  while the findings table, asset inventory, and evidence appendix are rendered directly
  from the recorded data (not the model), so the numbers can't be hallucinated — only the
  prose is AI-written, and it's clearly labeled as such. Downloadable as Markdown or as a
  real formatted Word (`.docx`) document — proper headings, tables, and a numbered
  remediation list, not a text dump.
- **GuardFort** — real-time PII redaction (emails, SSNs, card numbers, API keys, IPs,
  phone numbers) and prompt-injection risk scoring, applied to every message before it
  reaches the model and to every model response — including the triage and report output
  above — before it reaches the user.
- **ScanFort** — an automated red-teaming suite that fires 12 prompt-injection payloads
  (instruction override, jailbreak personas, encoding smuggling, PII exfiltration probes)
  at the local LLM once unprotected ("baseline") and once behind GuardFort ("protected"),
  so you can show the before/after live.

Everything runs on your own machine: a Node.js/Express backend, a local LLM served by
[Ollama](https://ollama.com), and a single-page dashboard (`public/index.html`) with no
build step. No cloud services, no API keys, no AWS.

## Architecture

```
┌─────────────────────┐      ┌──────────────────────────┐      ┌────────────────┐
│  public/index.html   │◄────►│  Node/Express backend      │◄────►│  Ollama (local) │
│  (dashboard UI)       │ HTTP │  - attack surface API      │ HTTP │  llama3/mistral │
│                       │      │  - AI triage + VAPT report  │      │                 │
│                       │      │  - GuardFort firewall       │      └────────────────┘
│                       │      │  - ScanFort red-team runner │
└─────────────────────┘      └──────────────────────────┘
```

- `server/data/` — seeded in-memory attack surface data (assets, findings, pipeline runs)
- `server/recon/` — the live passive recon pipeline: `dns.js` (DNS lookups), `subdomains.js`
  (crt.sh certificate-transparency enumeration), `fingerprint.js` (HTTP(S) header fetch),
  `scoring.js` (heuristic risk scoring + finding generation), `pipeline.js` (orchestration)
- `server/routes/intelligence.js` — dashboard/assets/findings/runs REST API (runs a real
  scan via `server/recon/` on `POST /api/runs`)
- `server/ai/triage.js` — LLM asset triage (priority, business impact, recommended action)
- `server/ai/report.js` — LLM-drafted VAPT report as Markdown (narrative + deterministic tables)
- `server/ai/docxReport.js` — the same report rendered as a real `.docx` (Word) file
- `server/routes/ai.js` — triage + report (Markdown and `.docx`) HTTP endpoints
- `server/security/guardfort.js` — PII regex firewall + prompt-injection heuristics
- `server/security/scanfort.js` — the red-team payload suite and scan runner
- `server/routes/security.js` — GuardFort + ScanFort HTTP endpoints
- `server/llm/ollama.js` — thin client for the local Ollama HTTP API
- `public/` — the single-page dashboard (vanilla HTML/CSS/JS, no build step)

## One-command setup

### 1. Install Ollama and pull a model

```bash
# macOS
brew install ollama

# or download from https://ollama.com

ollama serve            # starts the local LLM engine on :11434
ollama pull llama3      # or: ollama pull mistral
```

### 2. Run the platform

```bash
npm install
npm start
```

Open **http://localhost:5000** — the Overview, Assets and Findings tables populate
immediately from seeded demo data, no LLM required. Everything that calls the LLM —
the Assets tab's "Triage" button, the VAPT Report tab, and the GuardFort/ScanFort tabs —
needs `ollama serve` running with the model from step 1 pulled; the status pill top-right
shows live reachability.

Set a different model or Ollama host by copying `.env.example` to `.env`:

```bash
cp .env.example .env
# edit OLLAMA_MODEL=mistral, OLLAMA_HOST=http://127.0.0.1:11434, PORT=5000
```

### 3. (Optional) Hand off a live link with Cloudflare Tunnel

> **No built-in auth.** Every endpoint here — including the LLM-calling ones
> (`/api/ai/*`, `/api/scanfort/run`, `/api/guardfort/chat`) and the state-changing ones
> (`PATCH /api/findings/:id`) — is open to anyone who has the URL, with no rate limiting.
> That's fine for a link you open right before presenting and close (Ctrl+C) right after.
> It is **not** fine as something left running as a persistent public webserver — do not
> deploy this as-is behind a stable domain or leave a tunnel open unattended. If you ever
> need it reachable long-term, add an API-key check + rate limiting in front of `/api/ai`,
> `/api/scanfort`, and `/api/guardfort` first.

No AWS, no deploy pipeline — just tunnel your local port, only while you're actively
presenting:

```bash
brew install cloudflared          # or see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:5000
```

Cloudflare prints a public HTTPS URL that proxies straight to your laptop. Share it only
with the person you're presenting to, then stop the tunnel (Ctrl+C) the moment you're
done — nothing stays deployed anywhere. If you're just walking someone through it on your
own screen, skip this step entirely and stay on `http://localhost:5000`.

## Demo script

0. **Overview tab → "Run passive recon on a real target"** — type a real domain (e.g. a
   domain you control, or any public one) and an organization label, click "Run Passive
   Recon". Usually takes 5-15 seconds (up to ~1 minute if the certificate-transparency
   lookup is slow — it retries once automatically) and adds real assets/findings from
   actual DNS + certificate transparency + HTTP fingerprinting on top of the seeded demo
   data. Do this first so the rest of the demo can reference a target you just scanned
   live, not just canned data.
1. **Overview / Assets / Findings** — the passive recon output: seeded with ~20 assets and
   15 findings across all severities so the dashboard is never empty, plus whatever your
   live scan just added.
2. **Assets tab → "Triage" button** — click it on a high-risk asset (e.g. the exposed
   PostgreSQL service). The LLM reads the asset + its findings and returns a priority
   (P1–P4), business impact, and recommended action in a few seconds. This is the "asset
   triage" automation — a raw asset list becomes a worked queue.
3. **VAPT Report tab** — click "Generate VAPT Report (AI)". The LLM drafts the executive
   summary and remediation plan; the findings table, asset inventory, and evidence
   appendix come straight from the data. Download it live as either `.md` or a real
   formatted `.docx` (Word) — headings, color-coded severity tables, numbered remediation
   list — this is the "VAPT reporting" automation and the deliverable you'd actually hand
   someone.
4. **GuardFort tab** — paste a message containing PII and an injection attempt (a sample
   prompt is pre-filled as a placeholder). Show the redaction chips, the injection risk
   score, and that the sanitized text — not the raw text — is what goes to the LLM.
5. **ScanFort tab** — click "Run Red-Team Scan". It sends all 12 payloads twice (baseline
   vs. protected) and renders a side-by-side pass/fail table plus a "risk reduction %"
   headline number — the single strongest slide for the pitch.

## Notes

- Data is in-memory and reseeds on restart — safe to demo repeatedly with no state to
  reset by hand.
- GuardFort's PII/injection detection is pure regex/heuristics and works even if Ollama
  isn't running (use "Analyze only" in the GuardFort tab).
- Asset triage, VAPT report generation, ScanFort, and the GuardFort chat flow all need
  Ollama reachable at `OLLAMA_HOST`; the status pill in the header shows live reachability
  and whether the configured model is pulled.
- If a triage or report call errors out, it's almost always Ollama not running or the
  model not pulled yet — check the status pill first.
- **"Timed out waiting for Ollama"**: this almost always means Ollama is running but the
  model hasn't finished loading into memory yet (the first request after `ollama serve`
  starts can take well over a minute on a laptop CPU). The server automatically fires a
  background warmup request on startup (watch its terminal for "is warm and ready"), but
  if you start `npm start` before `ollama serve` has fully started, or switch models, warm
  it up manually before you need it: `ollama run llama3 "hi"`. Once warm, later requests
  are fast — only the first one after a fresh model load is slow.
- The passive recon scan needs normal internet access (DNS + HTTPS to crt.sh and to the
  target itself) — it does not need Ollama. If crt.sh is slow/unreachable it degrades
  gracefully: you still get the domain + resolved IP assets, with a note that subdomain
  enumeration was skipped, instead of the whole scan failing.
- Only scan domains you're authorized to test, or your own — this is passive-only
  (public DNS/CT-log lookups plus one unauthenticated request per host, no exploitation),
  but stick to targets you control or a demo domain for the pitch.
