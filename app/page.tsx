"use client";

import { useState } from "react";
import { Client } from "@gradio/client";

export default function HealthBuddyPage() {
  const [problemText, setProblemText] = useState("");
  const [data, setData] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported 😢");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lon: longitude });
        console.log("📍 Location:", latitude, longitude);
      },
      (err) => {
        console.error("❌ Location error:", err);
        alert("Please allow location access");
      }
    );
  };

  const handlePredict = async () => {
    if (!problemText.trim()) return alert("Please enter your symptoms!");
    if (!location) return alert("Please fetch your location!");

    setLoading(true);
    setData(null);
    try {
      const client = await Client.connect("gauravbhatt9854/healthBuddy");
      const result = await client.predict("/predict_disease_interface", {
        problem_text: problemText,
        latitude: location.lat,
        longitude: location.lon,
      });

      console.log("✅ API Response:", result.data);
      setData(result.data as string[]);
    } catch (error) {
      console.error("❌ Error calling HealthBuddy API:", error);
      setData(["Error contacting AI server"]);
    } finally {
      setLoading(false);
    }
  };

  // 🔍 Updated Doctor Extraction Logic (matches your provided data)
  const extractDoctors = (raw: string): any[] => {
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

  const doctors = data && data[3] ? extractDoctors(data[3]) : [];

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

        {/* 🔹 Output */}
        {loading && (
          <div className="text-center text-gray-600 text-lg font-semibold mt-4">
            🧠 Analyzing your symptoms...
          </div>
        )}

        {!loading && data && (
          <>
            {/* Condition Summary */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
              <h2 className="text-xl font-semibold text-blue-700 mb-2">
                🧠 Predicted Condition
              </h2>
              <p className="text-gray-800 whitespace-pre-wrap">
                {data[2].replace(/\*\*/g, "")}
              </p>
              <p className="mt-2 text-gray-700">
                {data[3]
                  .split("\n")[0]
                  .replace(/\*\*/g, "")
                  .replace("Recommended Specialist:", "Specialist:")}
              </p>
            </div>

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
          </>
        )}

        <div className="text-center mt-6 text-gray-400 text-sm">
          Powered by 🤗 Hugging Face & Gradio
        </div>
      </div>
    </div>
  );
}
