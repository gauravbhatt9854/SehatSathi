import { Client } from "@gradio/client";

type HuggingFaceArgs = {
  symptoms: string;
  latitude: number;
  longitude: number;
  ragContext: string;
  forceAttempt?: boolean;
};

type CircuitState = {
  failures: number;
  openedUntil: number;
};

export type HuggingFaceDebug = {
  attempted: boolean;
  success: boolean;
  skippedByCircuit: boolean;
  stage: "circuit-open" | "connect" | "predict" | "success" | "failed";
  error: string | null;
  startedAt: string;
  durationMs: number;
  timeoutMs: number;
  circuitBefore: ReturnType<typeof getHuggingFaceCircuitStatus>;
  circuitAfter: ReturnType<typeof getHuggingFaceCircuitStatus>;
};

export type HuggingFaceCallResult = {
  data: unknown;
  debug: HuggingFaceDebug;
};

const circuitState: CircuitState = {
  failures: 0,
  openedUntil: 0,
};

const failureThreshold = 2;
const cooldownMs = 2 * 60 * 1000;
const requestTimeoutMs = 45 * 1000;

export class CircuitOpenError extends Error {
  constructor() {
    super("Hugging Face circuit is open. Using RAG fallback.");
    this.name = "CircuitOpenError";
  }
}

export class HuggingFaceRequestError extends Error {
  debug: HuggingFaceDebug;

  constructor(debug: HuggingFaceDebug) {
    super(debug.error ?? "Hugging Face request failed.");
    this.name = "HuggingFaceRequestError";
    this.debug = debug;
  }
}

function isCircuitOpen() {
  return Date.now() < circuitState.openedUntil;
}

function recordSuccess() {
  circuitState.failures = 0;
  circuitState.openedUntil = 0;
}

function recordFailure() {
  circuitState.failures += 1;

  if (circuitState.failures >= failureThreshold) {
    circuitState.openedUntil = Date.now() + cooldownMs;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function withTimeout<T>(promise: Promise<T>) {
  let timeout: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error("Hugging Face request timed out.")),
      requestTimeoutMs
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

export function getHuggingFaceCircuitStatus() {
  return {
    failures: circuitState.failures,
    isOpen: isCircuitOpen(),
    retryAfterMs: Math.max(circuitState.openedUntil - Date.now(), 0),
  };
}

export async function callHealthBuddyModel({
  symptoms,
  latitude,
  longitude,
  ragContext,
  forceAttempt = false,
}: HuggingFaceArgs): Promise<HuggingFaceCallResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const circuitBefore = getHuggingFaceCircuitStatus();

  console.log("[HF Circuit] Before request:", circuitBefore);

  if (isCircuitOpen() && !forceAttempt) {
    const circuitAfter = getHuggingFaceCircuitStatus();
    const debug: HuggingFaceDebug = {
      attempted: false,
      success: false,
      skippedByCircuit: true,
      stage: "circuit-open",
      error: "Circuit is open, so Hugging Face was skipped.",
      startedAt,
      durationMs: Date.now() - startedAtMs,
      timeoutMs: requestTimeoutMs,
      circuitBefore,
      circuitAfter,
    };

    console.warn("[HF Circuit] OPEN - skipping Hugging Face call:", {
      retryAfterMs: circuitAfter.retryAfterMs,
    });

    throw new HuggingFaceRequestError(debug);
  }

  if (isCircuitOpen() && forceAttempt) {
    console.warn("[HF Circuit] OPEN - force attempt requested:", {
      retryAfterMs: circuitBefore.retryAfterMs,
    });
  }

  let stage: HuggingFaceDebug["stage"] = "connect";

  try {
    console.log("[HF] Connecting to Space:", {
      space: "gauravbhatt9854/healthBuddy",
      timeoutMs: requestTimeoutMs,
    });

    const client = await withTimeout(
      Client.connect("gauravbhatt9854/healthBuddy")
    );

    console.log("[HF] Connected. Calling predict endpoint:", {
      endpoint: "/predict_disease_interface",
    });

    const enhancedProblemText = `
User symptoms:
${symptoms}

Knowledge base context:
${ragContext}
`.trim();

    stage = "predict";

    const result = await withTimeout(
      client.predict("/predict_disease_interface", {
        problem_text: enhancedProblemText,
        latitude,
        longitude,
      })
    );

    if (!result.data) {
      throw new Error("Hugging Face returned an empty response.");
    }

    recordSuccess();
    const circuitAfter = getHuggingFaceCircuitStatus();
    const debug: HuggingFaceDebug = {
      attempted: true,
      success: true,
      skippedByCircuit: false,
      stage: "success",
      error: null,
      startedAt,
      durationMs: Date.now() - startedAtMs,
      timeoutMs: requestTimeoutMs,
      circuitBefore,
      circuitAfter,
    };

    console.log("[HF] Success:", debug);

    return {
      data: result.data,
      debug,
    };
  } catch (error) {
    recordFailure();
    const circuitAfter = getHuggingFaceCircuitStatus();
    const debug: HuggingFaceDebug = {
      attempted: true,
      success: false,
      skippedByCircuit: false,
      stage: "failed",
      error: `${stage}: ${getErrorMessage(error)}`,
      startedAt,
      durationMs: Date.now() - startedAtMs,
      timeoutMs: requestTimeoutMs,
      circuitBefore,
      circuitAfter,
    };

    console.error("[HF] Failed:", debug);

    throw new HuggingFaceRequestError(debug);
  }
}
