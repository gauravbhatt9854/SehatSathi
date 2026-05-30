import { NextResponse } from "next/server";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { symptoms, lat, lng } = await req.json();
    if (!symptoms || !lat || !lng) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    console.log("🧠 Symptoms received:", symptoms);

    // ✅ Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // ✅ Generate specialization from Gemini
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Which type of doctor should a patient visit for the following symptoms? Respond with only one specialization (like physician, ENT, neurologist, cardiologist, orthopedic, gynecologist, dermatologist).
              Symptoms: ${symptoms}`,
            },
          ],
        },
      ],
    });

    const specialization = result.response.text().trim();
    console.log("✅ Gemini specialization:", specialization);

    // -----------------------------------------------------------------
    // 🔹 STEP 1: Google Places API (Nearby Search)
    // Get a list of place_ids for relevant doctors
    // -----------------------------------------------------------------
    const nearbySearchRes = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${lat},${lng}`,
          radius: 5000,
          keyword: `doctor ${specialization}`, // Be more specific in keyword
          type: "doctor", // Filter results to the "doctor" type
          key: process.env.GOOGLE_MAPS_KEY,
        },
      }
    );

    if (nearbySearchRes.data.status !== "OK") {
      console.error("⚠️ Google Nearby Search API error:", nearbySearchRes.data);
      return NextResponse.json(
        { error: "Google Places API (Nearby Search) failed", details: nearbySearchRes.data },
        { status: 500 }
      );
    }

    const places = nearbySearchRes.data.results;
    
    if (!places || places.length === 0) {
      // No doctors found, return gracefully
      return NextResponse.json({
        specialization,
        doctors: [],
      });
    }

    // -----------------------------------------------------------------
    // 🔹 STEP 2: Google Places API (Place Details)
    // Get full details for each place_id found in Step 1
    // -----------------------------------------------------------------

    // Define the specific fields you want.
    // ADDED 'place_id' to this list
    const fields = [
      "place_id",
      "name",
      "vicinity",
      "formatted_phone_number",
      "website",
      "rating",
      "user_ratings_total",
      "geometry.location",
      "opening_hours"
    ].join(",");

    // Create an array of promises, one for each detail request
    const detailRequests = places.map((place: any) => {
      return axios.get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        {
          params: {
            place_id: place.place_id, // The ID from the nearby search
            fields: fields,          // Request *only* the fields you need
            key: process.env.GOOGLE_MAPS_KEY,
          },
        }
      );
    });

    // Execute all detail requests in parallel for speed
    const detailResponses = await Promise.all(detailRequests);

    // Map the *full details* from the second API call
    const doctors = detailResponses.map((res: any) => {
      const doc = res.data.result;
      return {
        place_id: doc.place_id, // ADDED this line
        name: doc.name,
        address: doc.vicinity,
        phone: doc.formatted_phone_number || null,
        website: doc.website || null,
        opening_hours: doc.opening_hours || null,
        rating: doc.rating,
        total_ratings: doc.user_ratings_total,
        location: doc.geometry.location,
      };
    });

    // ✅ Final Response
    return NextResponse.json({
      specialization,
      doctors,
    });

  } catch (err: any) {
    console.error("💥 Error Source:", err.response?.data || err.message || err);
    return NextResponse.json(
      {
        error: "Gemini or Google API error occurred.",
        details: err.response?.data || err.message,
      },
      { status: 500 }
    );
  }
}