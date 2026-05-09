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

type FastApiDoctor = {
  name?: string;
  address?: string;
  phone?: string | null;
  website?: string | null;
  rating?: number | string | null;
  total_ratings?: number | null;
};

type FastApiResponse = {
  symptoms?: string[];
  predictions?: Record<string, string>;
  final_disease?: string;
  specialization?: string;
  doctors_nearby?: FastApiDoctor[];
  detected_location_name?: string;
  error?: string;
  raw_input?: string;
};

export type DoctorCard = {
  name: string;
  address: string;
  phone: string;
  rating: string;
  website: string;
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
  endpoint: string;
};

export type HuggingFaceCallResult = {
  data: string[];
  doctors: DoctorCard[];
  raw: FastApiResponse;
  debug: HuggingFaceDebug;
};

const circuitState: CircuitState = {
  failures: 0,
  openedUntil: 0,
};

const failureThreshold = 2;
const cooldownMs = 2 * 60 * 1000;
const requestTimeoutMs = 5 * 60 * 1000;
const endpoint =
  process.env.HEALTHBUDDY_HF_API_URL ??
  "https://gauravbhatt9854-healthbuddy.hf.space/predict";

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

function formatDoctors(doctors: FastApiDoctor[] = []): DoctorCard[] {
  return doctors.map((doctor) => ({
    name: doctor.name ?? "Unknown Doctor",
    address: doctor.address ?? "",
    phone: doctor.phone ?? "",
    website: doctor.website ?? "",
    rating:
      doctor.rating === undefined || doctor.rating === null
        ? ""
        : `${doctor.rating}${
            doctor.total_ratings ? ` (${doctor.total_ratings} ratings)` : ""
          }`,
  }));
}

function buildModelData(response: FastApiResponse): string[] {
  const disease = response.final_disease ?? "Unknown condition";
  const specialization = response.specialization ?? "Physician";
  const symptoms = response.symptoms?.join(", ") || "No symptoms extracted";
  const predictions = response.predictions
    ? Object.entries(response.predictions)
        .map(([model, prediction]) => `${model}: ${prediction}`)
        .join(", ")
    : "No model predictions returned";

  const doctorLines = (response.doctors_nearby ?? [])
    .slice(0, 5)
    .map((doctor, index) => {
      return `**${index + 1}. ${doctor.name ?? "Unknown Doctor"}**
Address: ${doctor.address ?? ""}
Phone: ${doctor.phone ?? ""}
Rating: ${doctor.rating ?? ""}
Website: ${doctor.website ?? ""}`;
    })
    .join("\n\n");

  return [
    symptoms,
    predictions,
    `Predicted condition: ${disease}. Extracted symptoms: ${symptoms}.`,
    `Recommended Specialist: ${specialization}

${doctorLines}`,
  ];
}

export function getHuggingFaceCircuitStatus() {
  return {
    failures: circuitState.failures,
    isOpen: isCircuitOpen(),
    retryAfterMs: Math.max(circuitState.openedUntil - Date.now(), 0),
  };
}

export async function callHealthBuddyModel(
  args: HuggingFaceArgs
): Promise<HuggingFaceCallResult> {
  const { symptoms, latitude, longitude, forceAttempt = false } = args;
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
      endpoint,
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
    console.log("[HF] Calling FastAPI endpoint:", {
      endpoint,
      timeoutMs: requestTimeoutMs,
    });

    // The Hugging Face FastAPI app uses Gemini to extract exact symptoms from
    // the user's complaint, so keep this field clean and do not append RAG text.
    const problem = symptoms;

    stage = "predict";

    const response = await withTimeout(
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          problem,
          lat: latitude,
          lng: longitude,
        }),
      })
    );

    const json = (await response.json()) as FastApiResponse;

    if (!response.ok || json.error) {
      throw new Error(json.error ?? `HTTP ${response.status}`);
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
      endpoint,
    };

    console.log("[HF] Success:", debug);

    return {
      data: buildModelData(json),
      doctors: formatDoctors(json.doctors_nearby),
      raw: json,
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
      endpoint,
    };

    console.error("[HF] Failed:", debug);

    throw new HuggingFaceRequestError(debug);
  }
}
