"use client";

import { useState, useEffect } from "react";

export default function HealthBuddyPage() {
  const [problemText, setProblemText] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");

  // Automatically request location on component mount
  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setLocationStatus("denied");
      return;
    }

    setLocationStatus("requesting");
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        setLocationStatus("granted");
        console.log("Location obtained:", latitude, longitude);
      },
      (err) => {
        console.error("Location error:", err);
        setLocationStatus("denied");
        if (err.code === 1) {
          console.log("User denied location access");
        } else if (err.code === 2) {
          console.log("Location unavailable");
        } else if (err.code === 3) {
          console.log("Location request timeout");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setLocationStatus("requesting");
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        setLocationStatus("granted");
        console.log("Location:", latitude, longitude);
      },
      (err) => {
        console.error("Location error:", err);
        setLocationStatus("denied");
        alert("Unable to get location. Please enable location access in your browser settings.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handlePredict = async () => {

    const NEXT_PUBLIC_HUGGING_FACE_API= process.env.NEXT_PUBLIC_HUGGING_FACE_API!;
    if (!problemText.trim()) return alert("Please enter your symptoms!");
    if (!location) return alert("Please enable location access to find nearby doctors!");


    setLoading(true);
    setData(null);
    try {
      // Update the URL to match your backend
      const res = await fetch(NEXT_PUBLIC_HUGGING_FACE_API, // Change this to your backend URL
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            problem: problemText,
            lat: location.lat,
            lng: location.lng,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const result = await res.json();
      console.log("API Response:", result);
      
      if (result.error) {
        alert(`Error: ${result.error}`);
        setData(null);
      } else {
        setData(result);
      }
    } catch (error) {
      console.error("Error calling HealthBuddy API:", error);
      alert("Error contacting AI server. Please check if the backend is running.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Get button text and style based on location status
  const getLocationButtonProps = () => {
    switch (locationStatus) {
      case "requesting":
        return {
          text: "Getting Location...",
          className:
            "flex-1 px-6 py-3 bg-blue-100 border-2 border-blue-200 text-blue-600 font-semibold rounded-xl cursor-wait opacity-70",
        };
      case "granted":
        return {
          text: "📍 Location Set",
          className:
            "flex-1 px-6 py-3 bg-green-50 border-2 border-green-300 text-green-700 font-semibold rounded-xl hover:bg-green-100 transition-all focus:outline-none focus:ring-2 focus:ring-green-400",
        };
      case "denied":
        return {
          text: "📍 Enable Location",
          className:
            "flex-1 px-6 py-3 bg-amber-50 border-2 border-amber-300 text-amber-700 font-semibold rounded-xl hover:bg-amber-100 hover:border-amber-400 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400",
        };
      default:
        return {
          text: "📍 Get My Location",
          className:
            "flex-1 px-6 py-3 bg-white border-2 border-blue-200 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400",
        };
    }
  };

  const locationButton = getLocationButtonProps();

  return (
    <div className="p-8">
      {/* Input Section */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Describe Your Symptoms
        </label>
        <textarea
          className="w-full border-2 border-blue-100 rounded-xl p-4 text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
          rows={5}
          placeholder="e.g., I have a persistent headache with nausea and sensitivity to light..."
          value={problemText}
          onChange={(e) => setProblemText(e.target.value)}
        />
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          onClick={getLocation}
          disabled={locationStatus === "requesting"}
          className={locationButton.className}
        >
          {locationButton.text}
        </button>
        <button
          onClick={handlePredict}
          disabled={loading}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Analyzing...
            </span>
          ) : (
            "Find Doctors"
          )}
        </button>
      </div>

      {/* Location Status Display */}
      {location && locationStatus === "granted" && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="text-sm text-green-700">
            <span className="font-semibold">📍 Location Active:</span>{" "}
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </p>
        </div>
      )}

      {locationStatus === "denied" && !location && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
          <p className="text-sm text-amber-700">
            <span className="font-semibold">⚠️ Location Access Needed:</span> Please
            click "Enable Location" to find nearby doctors
          </p>
        </div>
      )}

      {locationStatus === "requesting" && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-sm text-blue-700">
            <span className="font-semibold">📍 Requesting location...</span> Please
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
      {!loading && data && !data.error && (
        <div className="space-y-6">
          {/* Detected Location */}
          {data.detected_location_name && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-600">
                <span className="font-semibold">📍 Searching near:</span>{" "}
                {data.detected_location_name}
              </p>
            </div>
          )}

          {/* Detected Symptoms */}
          {data.symptoms && data.symptoms.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-amber-700 mb-3">
                🔍 Detected Symptoms
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.symptoms.map((symptom: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium"
                  >
                    {symptom.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Condition Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-blue-700 mb-3 flex items-center">
              <span className="mr-2">🩺</span>
              Predicted Condition
            </h2>
            <div className="space-y-2">
              <p className="text-slate-800 text-lg font-semibold">
                {data.final_disease}
              </p>
              <p className="text-slate-700 font-medium pt-2 border-t border-blue-200">
                Specialist: {data.specialization}
              </p>
              
              {/* Show all model predictions */}
              {data.predictions && (
                <div className="pt-3 mt-3 border-t border-blue-200">
                  <p className="text-sm text-slate-600 mb-2">Model Predictions:</p>
                  <div className="space-y-1">
                    {Object.entries(data.predictions).map(([model, prediction]) => (
                      <div key={model} className="text-sm">
                        <span className="font-medium text-slate-700">{model}:</span>{" "}
                        <span className="text-slate-600">{prediction as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Doctor List */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center">
              <span className="mr-2">👨‍⚕️</span>
              Recommended Doctors Near You
            </h2>

            {(!data.doctors_nearby || data.doctors_nearby.length === 0) && (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-600">No doctors found nearby. Try expanding your search area.</p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {data.doctors_nearby && data.doctors_nearby.map((doc: any, idx: number) => (
                <div
                  key={idx}
                  className="p-5 border border-blue-100 rounded-2xl bg-white hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300"
                >
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {doc.name}
                  </h3>
                  {doc.address && (
                    <p className="text-slate-600 text-sm mb-3 leading-relaxed">
                      📍 {doc.address}
                    </p>
                  )}
                  {doc.rating && (
                    <p className="text-amber-600 text-sm mb-3 font-medium">
                      ⭐ {doc.rating} ({doc.total_ratings || 0} reviews)
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {doc.phone && (
                      <a
                        href={`tel:${doc.phone.replace(/\s+/g, "")}`}
                        className="inline-flex items-center bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <span className="mr-1">📞</span>
                        Call
                      </a>
                    )}
                    {doc.website && (
                      <a
                        href={doc.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <span className="mr-1">🌐</span>
                        Website
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {!loading && data && data.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="text-red-700 font-semibold mb-2">Error</h3>
          <p className="text-red-600">{data.error}</p>
          {data.raw_input && (
            <p className="text-sm text-red-500 mt-2">Input: {data.raw_input}</p>
          )}
        </div>
      )}

      {/* Footer Note */}
      {!loading && data && !data.error && (
        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-slate-400 text-sm">
            Powered by FastAPI & Google Gemini AI
          </p>
        </div>
      )}
    </div>
  );
}
