# Attack Surface Intelligence + RakFort AI Security (local demo)

A fully local Attack Surface Intelligence dashboard upgraded with RakFort AI Security
capabilities:

- **GuardFort** — real-time PII redaction (emails, SSNs, card numbers, API keys, IPs,
  phone numbers) and prompt-injection risk scoring, applied to every message before it
  reaches the model and to every model response before it reaches the user.
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
│                       │      │  - GuardFort firewall       │      │                 │
│                       │      │  - ScanFort red-team runner │      └────────────────┘
└─────────────────────┘      └──────────────────────────┘
```

- `server/data/` — seeded in-memory attack surface data (assets, findings, pipeline runs)
- `server/routes/intelligence.js` — dashboard/assets/findings/runs REST API
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

Open **http://localhost:5000** — the Overview, Assets and Findings tabs work
immediately (seeded demo data, no LLM required). The GuardFort and ScanFort tabs call
into Ollama, so make sure `ollama serve` is running and the model from step 1 is pulled.

Set a different model or Ollama host by copying `.env.example` to `.env`:

```bash
cp .env.example .env
# edit OLLAMA_MODEL=mistral, OLLAMA_HOST=http://127.0.0.1:11434, PORT=5000
```

### 3. (Optional) Hand off a live link with Cloudflare Tunnel

No AWS, no deploy pipeline — just tunnel your local port:

```bash
brew install cloudflared          # or see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:5000
```

Cloudflare prints a public HTTPS URL that proxies straight to your laptop. Share it,
then stop the tunnel (Ctrl+C) when you're done — nothing stays deployed anywhere.

## Demo script

1. **Overview / Assets / Findings** — the "regular" attack surface intelligence product:
   seeded with ~20 assets and 15 findings across all severities so the dashboard is never
   empty.
2. **GuardFort tab** — paste a message containing PII and an injection attempt (a sample
   prompt is pre-filled as a placeholder). Show the redaction chips, the injection risk
   score, and that the sanitized text — not the raw text — is what goes to the LLM.
3. **ScanFort tab** — click "Run Red-Team Scan". It sends all 12 payloads twice (baseline
   vs. protected) and renders a side-by-side pass/fail table plus a "risk reduction %"
   headline number — the single strongest slide for the pitch.

## Notes

- Data is in-memory and reseeds on restart — safe to demo repeatedly with no state to
  reset by hand.
- GuardFort's PII/injection detection is pure regex/heuristics and works even if Ollama
  isn't running (use "Analyze only" in the GuardFort tab).
- ScanFort and the GuardFort chat flow need Ollama reachable at `OLLAMA_HOST`; the status
  pill in the header shows live reachability and whether the configured model is pulled.
