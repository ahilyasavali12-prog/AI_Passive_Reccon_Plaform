const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

export async function status() {
  const { signal, cancel } = withTimeout(2500);
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal });
    cancel();
    if (!res.ok) return { reachable: false, model: OLLAMA_MODEL, host: OLLAMA_HOST };
    const data = await res.json();
    const models = (data.models ?? []).map((m) => m.name);
    return {
      reachable: true,
      model: OLLAMA_MODEL,
      host: OLLAMA_HOST,
      modelAvailable: models.some((m) => m === OLLAMA_MODEL || m.startsWith(`${OLLAMA_MODEL}:`)),
      availableModels: models,
    };
  } catch {
    cancel();
    return { reachable: false, model: OLLAMA_MODEL, host: OLLAMA_HOST };
  }
}

export async function generate(prompt, { temperature = 0.4, numPredict = 200, timeoutMs = 60000 } = {}) {
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature, num_predict: numPredict },
      }),
      signal,
    });
    cancel();
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama responded ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.response ?? "";
  } catch (err) {
    cancel();
    if (err.name === "AbortError") {
      throw new Error("Timed out waiting for the local LLM (Ollama). Is `ollama serve` running and is the model pulled?");
    }
    throw new Error(`Could not reach Ollama at ${OLLAMA_HOST}: ${err.message}`);
  }
}

export { OLLAMA_HOST, OLLAMA_MODEL };
