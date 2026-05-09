"use client";

import { useState } from "react";

type DoctorCard = {
  name: string;
  address: string;
  phone: string;
  rating: string;
  website: string;
};

type RagResponse = {
  matched: boolean;
  specialist: string;
  condition: string;
  advice: string;
  context: string;
  matches: {
    id: string;
    condition: string;
    specialist: string;
    urgency?: "normal" | "urgent" | "emergency";
    advice: string;
    score: number;
  }[];
};

type HealthCheckResponse = {
  source: "huggingface" | "rag-fallback";
  mode: "rag-assisted" | "huggingface-only";
  warning?: string;
  error?: string;
  rag: RagResponse | null;
  data: string[];
  doctors?: DoctorCard[];
  huggingFace?: {
    attempted: boolean;
    success: boolean;
    skippedByCircuit: boolean;
    stage: string;
    error: string | null;
    startedAt: string;
    durationMs: number;
    timeoutMs: number;
    circuitBefore: {
      failures: number;
      isOpen: boolean;
      retryAfterMs: number;
    };
    circuitAfter: {
      failures: number;
      isOpen: boolean;
      retryAfterMs: number;
    };
  };
  circuit?: {
    failures: number;
    isOpen: boolean;
    retryAfterMs: number;
  };
};

export default function HealthBuddyPage() {
  const [problemText, setProblemText] = useState("");
  const [data, setData] = useState<string[] | null>(null);
  const [responseSource, setResponseSource] =
    useState<HealthCheckResponse["source"] | null>(null);
  const [responseMode, setResponseMode] =
    useState<HealthCheckResponse["mode"] | null>(null);
  const [ragResult, setRagResult] = useState<RagResponse | null>(null);
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null);
  const [fallbackDoctors, setFallbackDoctors] = useState<DoctorCard[] | null>(
    null
  );
  const [useHuggingFaceOnly, setUseHuggingFaceOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported 😢");
      setLocationStatus("denied");
      return;
    }

    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lon: longitude });
        setLocationStatus("granted");
        console.log("📍 Location:", latitude, longitude);
      },
      (err) => {
        console.error("❌ Location error:", err);
        setLocationStatus("denied");
        alert("Please allow location access");
      }
    );
  };

  const handlePredict = async () => {
    if (!problemText.trim()) return alert("Please enter your symptoms!");
    if (!location) return alert("Please fetch your location!");

    setLoading(true);
    setData(null);
    setResponseSource(null);
    setResponseMode(null);
    setRagResult(null);
    setFallbackWarning(null);
    setFallbackDoctors(null);
    try {
      const response = await fetch("/api/health-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symptoms: problemText,
          latitude: location.lat,
          longitude: location.lon,
          useHuggingFaceOnly,
        }),
      });

      const result = (await response.json()) as HealthCheckResponse;

      console.log("API Response:", result);
      console.group("HealthBuddy backend debug");
      console.log("Mode:", result.mode);
      console.log("Response source:", result.source);
      console.log("Hugging Face status:", result.huggingFace);
      console.log("Circuit status:", result.circuit);
      console.log("RAG status:", result.rag);
      console.groupEnd();

      if (!response.ok) {
        console.error("Health check failed:", result.error, result);
      }

      setData(result.data);
      setResponseSource(result.source);
      setResponseMode(result.mode);
      setRagResult(result.rag);
      setFallbackWarning(result.warning ?? result.error ?? null);
      setFallbackDoctors(result.doctors ?? null);
    } catch (error) {
      console.error("Error calling HealthBuddy API:", error);
      setData([
        "",
        "",
        "Unable to complete the health check right now. Please try again.",
        "Recommended Specialist: Physician",
      ]);
      setResponseSource(useHuggingFaceOnly ? "huggingface" : "rag-fallback");
      setResponseMode(
        useHuggingFaceOnly ? "huggingface-only" : "rag-assisted"
      );
      setFallbackWarning("Unable to reach the health check service.");
    } finally {
      setLoading(false);
    }
  };

  // Updated Doctor Extraction Logic
  const extractDoctors = (raw: string): DoctorCard[] => {
    const doctorBlocks = raw
      .split(/\*\*\d+\.\s*/)
      .filter((block) => block.trim().startsWith("Dr") || block.includes("Dr."));

    const doctors = doctorBlocks.map((block) => {
      const nameMatch = block.match(/Dr[^\n]*/);
      const addressMatch = block.match(/📍(.*)/);
      const phoneMatch = block.match(/📞(.*)/);
      const ratingMatch = block.match(/⭐(.*)/);
      const websiteMatch = block.match(/🌐(.*)/);

      return {
        name: nameMatch ? nameMatch[0].trim() : "Unknown Doctor",
        address: addressMatch ? addressMatch[1].trim() : "",
        phone: phoneMatch ? phoneMatch[1].trim() : "",
        rating: ratingMatch ? ratingMatch[1].trim() : "",
        website: websiteMatch ? websiteMatch[1].trim() : "",
      };
    });

    return doctors;
  };

  const doctors = fallbackDoctors ?? (data && data[3] ? extractDoctors(data[3]) : []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center py-10 px-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <h1 className="text-3xl font-bold text-center mb-6 text-blue-700">
          🩺 HealthBuddy — Doctor Finder AI
        </h1>

        {/* 🔹 Input */}
        <textarea
          className="w-full border rounded-lg p-3 mb-4 text-gray-700"
          rows={4}
          placeholder="Describe your health issue (e.g. chest pain, fever, cough)..."
          value={problemText}
          onChange={(e) => setProblemText(e.target.value)}
        />
      </div>

      <label className="mb-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={useHuggingFaceOnly}
          onChange={(event) => setUseHuggingFaceOnly(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
        />
        <span>
          <span className="block font-semibold text-slate-900">
            Use Hugging Face only
          </span>
          <span className="block text-slate-500">
            Skip the knowledge-base RAG fallback for this request.
          </span>
        </span>
      </label>

        {/* 🔹 Buttons */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={getLocation}
            className="flex-1 bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg hover:bg-gray-300 transition"
          >
            📍 Get Location
          </button>
          <button
            onClick={handlePredict}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
          >
            {loading ? "Analyzing..." : "Find Doctors"}
          </button>
        </div>

        {location && (
          <p className="text-sm text-gray-500 mb-4 text-center">
            🌎 Location: {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
          </p>
        )}

      {locationStatus === "denied" && !location && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
          <p className="text-sm text-amber-700">
            <span className="font-semibold"> Location Access Needed:</span> Please
            click &quot;Enable Location&quot; to find nearby doctors
          </p>
        </div>
      )}

      {locationStatus === "requesting" && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-sm text-blue-700">
            <span className="font-semibold"> Requesting location...</span> Please
            allow access when prompted
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">
              Analyzing your symptoms...
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && data && (
        <div className="space-y-6">
          {fallbackWarning && (
            <div
              className={`rounded-2xl border p-4 ${
                responseSource === "rag-fallback"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  responseSource === "rag-fallback"
                    ? "text-amber-800"
                    : "text-red-800"
                }`}
              >
                {fallbackWarning}
              </p>
              {responseSource === "rag-fallback" && (
                <p className="text-sm text-amber-700 mt-1">
                  The Hugging Face model will be used again automatically when
                  it becomes available.
                </p>
              )}
            </div>
          )}

          {responseMode === "rag-assisted" && ragResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <p className="text-sm font-semibold text-emerald-800 mb-2">
                Knowledge Base Match
              </p>
              <p className="text-slate-800 font-medium">
                {ragResult.condition} → {ragResult.specialist}
              </p>
              <p className="text-sm text-slate-600 mt-2">
                {ragResult.advice}
              </p>
              {ragResult.matches.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {ragResult.matches.slice(0, 3).map((match) => (
                    <span
                      key={match.id}
                      className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700"
                    >
                      {match.specialist} · score {match.score}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Condition Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-blue-700 mb-3 flex items-center">
              <span className="mr-2"></span>
              Predicted Condition
            </h2>
            <div className="space-y-2">
              <p className="text-slate-800 leading-relaxed">
                {data[2].replace(/\*\*/g, "")}
              </p>
              <p className="mt-2 text-gray-700">
                {data[3]
                  .split("\n")[0]
                  .replace(/\*\*/g, "")
                  .replace("Recommended Specialist:", "Specialist:")}
              </p>
            </div>
          </div>

          <div>
            {/* Doctor List */}
            <h2 className="text-2xl font-bold text-blue-700 mb-4">
              👨‍⚕️ Recommended Doctors
            </h2>

            {doctors.length === 0 && (
              <p className="text-gray-600">No doctor data found 😢</p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {doctors.map((doc, idx) => (
                <div
                  key={idx}
                  className="p-4 border rounded-xl bg-gray-50 hover:shadow-md transition"
                >
                  <h3 className="text-lg font-semibold text-blue-800 mb-1">
                    {doc.name}
                  </h3>
                  <p className="text-gray-700 text-sm mb-2">{doc.address}</p>
                  {doc.rating && (
                    <p className="text-yellow-600 text-sm mb-1">
                      ⭐ {doc.rating}
                    </p>
                  )}
                  {doc.phone && (
                    <a
                      href={`tel:${doc.phone.replace(/\s+/g, "")}`}
                      className="inline-block bg-green-600 text-white text-sm px-3 py-1 rounded-md hover:bg-green-700 mr-2"
                    >
                      📞 Call
                    </a>
                  )}
                  {doc.website && (
                    <a
                      href={doc.website.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-blue-600 text-white text-sm px-3 py-1 rounded-md hover:bg-blue-700"
                    >
                      🌐 Website
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

      {/* Footer Note */}
      {!loading && data && (
        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-slate-400 text-sm">
            Powered by Hugging Face & Gradio
            {responseSource === "rag-fallback" ? " with RAG fallback" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
