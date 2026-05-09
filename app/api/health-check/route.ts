import { NextResponse } from "next/server";
import { buildRagOnlyModelData, getRagContext } from "@/lib/rag";
import {
  callHealthBuddyModel,
  getHuggingFaceCircuitStatus,
  HuggingFaceRequestError,
} from "@/lib/huggingface";

export async function POST(req: Request) {
  const { symptoms, latitude, longitude, useHuggingFaceOnly = false } =
    await req.json();

  if (!symptoms || !latitude || !longitude) {
    return NextResponse.json(
      { error: "Missing symptoms or location." },
      { status: 400 }
    );
  }

  if (useHuggingFaceOnly) {
    try {
      const huggingFace = await callHealthBuddyModel({
        symptoms,
        latitude,
        longitude,
        ragContext:
          "RAG knowledge base was disabled by the user for this request.",
        forceAttempt: true,
      });

      return NextResponse.json({
        source: "huggingface",
        mode: "huggingface-only",
        rag: null,
        data: huggingFace.data,
        doctors: huggingFace.doctors,
        huggingFaceRaw: huggingFace.raw,
        huggingFace: huggingFace.debug,
        circuit: getHuggingFaceCircuitStatus(),
      });
    } catch (error) {
      console.error("Hugging Face-only request failed:", error);
      const huggingFace =
        error instanceof HuggingFaceRequestError
          ? error.debug
          : {
              attempted: true,
              success: false,
              skippedByCircuit: false,
              stage: "failed",
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown Hugging Face error",
              startedAt: new Date().toISOString(),
              durationMs: 0,
              timeoutMs: 45000,
              circuitBefore: getHuggingFaceCircuitStatus(),
              circuitAfter: getHuggingFaceCircuitStatus(),
            };

      return NextResponse.json(
        {
          source: "huggingface",
          mode: "huggingface-only",
          error: "Hugging Face is unavailable and RAG fallback is disabled.",
          warning:
            "Hugging Face-only mode was selected, so no knowledge-base fallback was used.",
          rag: null,
          data: [
            "",
            "",
            "Hugging Face is unavailable right now, and RAG fallback is disabled for this request.",
            "Recommended Specialist: Not available",
          ],
          doctors: [],
          huggingFace,
          circuit: getHuggingFaceCircuitStatus(),
        },
        { status: 503 }
      );
    }
  }

  const rag = getRagContext(symptoms);

  try {
    const huggingFace = await callHealthBuddyModel({
      symptoms,
      latitude,
      longitude,
      ragContext: rag.context,
    });

    return NextResponse.json({
      source: "huggingface",
      mode: "rag-assisted",
      rag,
      data: huggingFace.data,
      doctors: huggingFace.doctors,
      huggingFaceRaw: huggingFace.raw,
      huggingFace: huggingFace.debug,
      circuit: getHuggingFaceCircuitStatus(),
    });
  } catch (error) {
    console.error("Hugging Face unavailable, using RAG fallback:", error);
    const huggingFace =
      error instanceof HuggingFaceRequestError
        ? error.debug
        : {
            attempted: true,
            success: false,
            skippedByCircuit: false,
            stage: "failed",
            error:
              error instanceof Error
                ? error.message
                : "Unknown Hugging Face error",
            startedAt: new Date().toISOString(),
            durationMs: 0,
            timeoutMs: 45000,
            circuitBefore: getHuggingFaceCircuitStatus(),
            circuitAfter: getHuggingFaceCircuitStatus(),
          };

    return NextResponse.json({
      source: "rag-fallback",
      mode: "rag-assisted",
      warning:
        "The AI model is currently unavailable, so this result is based on the local knowledge base.",
      rag,
      huggingFace,
      data: buildRagOnlyModelData(rag),
      doctors: [
        {
          name: `Consult a ${rag.specialist}`,
          address: rag.advice,
          rating: "Knowledge base fallback",
          phone: "",
          website: "",
        },
      ],
      circuit: getHuggingFaceCircuitStatus(),
    });
  }
}
