// GuardFort: real-time PII redaction + prompt-injection heuristic firewall.
// Runs entirely locally, no external calls — pure regex/heuristic analysis.

const PII_PATTERNS = [
  { type: "EMAIL", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "CREDIT_CARD", regex: /\b(?:\d[ -]*?){13,16}\b/g, validate: luhnCheck },
  { type: "PHONE", regex: /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g },
  { type: "AWS_ACCESS_KEY", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: "API_KEY", regex: /\b(sk|pk|rk)-[A-Za-z0-9]{20,}\b/g },
  { type: "IP_ADDRESS", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
];

function luhnCheck(match) {
  const digits = match.replace(/[ -]/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function redactPII(text) {
  let sanitized = text;
  const redactions = [];
  for (const { type, regex, validate } of PII_PATTERNS) {
    sanitized = sanitized.replace(regex, (match) => {
      if (validate && !validate(match)) return match;
      redactions.push({ type, value: match });
      return `[REDACTED:${type}]`;
    });
  }
  return { sanitized, redactions };
}

const INJECTION_SIGNALS = [
  { weight: 3, label: "instruction override", regex: /ignore\s+(all\s+|every\s+)?(previous|prior|above)\s+instructions?/i },
  { weight: 3, label: "system prompt disregard", regex: /disregard\s+(the\s+)?(system|previous)\s+prompt/i },
  { weight: 3, label: "system prompt exfiltration", regex: /(reveal|print|show|repeat)\s+(your|the)\s+(system\s+prompt|instructions)/i },
  { weight: 2, label: "persona hijack", regex: /you\s+are\s+now\s+(dan|an?\s+unrestricted)/i },
  { weight: 2, label: "developer mode", regex: /developer\s+mode/i },
  { weight: 2, label: "safety bypass", regex: /bypass\s+(your|the)\s+(safety|content)\s+(filter|polic\w*)/i },
  { weight: 2, label: "restriction removal", regex: /(no\s+restrictions|without\s+any\s+restrictions|do\s+anything\s+now)/i },
  { weight: 1, label: "role-play jailbreak framing", regex: /(let'?s\s+play\s+a\s+game|stay\s+in\s+character|pretend\s+to\s+have\s+no)/i },
  { weight: 1, label: "authority impersonation", regex: /as\s+the\s+(system\s+)?administrator,?\s+i\s+am\s+overriding/i },
  { weight: 1, label: "delimiter smuggling", regex: /---\s*(end of|system:|begin)/i },
];

export function analyzeInjection(text) {
  const reasons = [];
  let score = 0;
  for (const signal of INJECTION_SIGNALS) {
    if (signal.regex.test(text)) {
      score += signal.weight;
      reasons.push(signal.label);
    }
  }
  const risk = score >= 4 ? "high" : score >= 2 ? "medium" : score > 0 ? "low" : "none";
  return { score, risk, reasons };
}

const BLOCK_THRESHOLD = 4;

export function analyzeInbound(text) {
  const injection = analyzeInjection(text);
  const { sanitized, redactions } = redactPII(text);
  return {
    blocked: injection.score >= BLOCK_THRESHOLD,
    riskScore: injection.score,
    risk: injection.risk,
    reasons: injection.reasons,
    sanitizedText: sanitized,
    redactions,
  };
}

export function analyzeOutbound(text) {
  const { sanitized, redactions } = redactPII(text);
  return { sanitizedText: sanitized, redactions };
}
