import healthDocuments from "@/data/health-documents.json";

export type RagMatch = {
  id: string;
  condition: string;
  specialist: string;
  urgency?: "normal" | "urgent" | "emergency";
  advice: string;
  score: number;
};

export type RagResult = {
  matched: boolean;
  specialist: string;
  condition: string;
  advice: string;
  context: string;
  matches: RagMatch[];
};

const defaultResult = {
  condition: "General health concern",
  specialist: "Physician",
  advice:
    "The symptoms need a general medical review. Please consult a qualified physician, especially if symptoms are severe, worsening, or persistent.",
};

const urgencyRank = {
  emergency: 3,
  urgent: 2,
  normal: 1,
};

type HealthDocument = {
  id: string;
  condition: string;
  specialist: string;
  urgency?: "normal" | "urgent" | "emergency";
  symptoms: string[];
  text: string;
  advice: string;
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "have",
  "has",
  "i",
  "in",
  "is",
  "it",
  "little",
  "may",
  "my",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
]);

const synonymMap: Record<string, string[]> = {
  ache: ["pain"],
  aching: ["pain"],
  bodyache: ["body", "pain"],
  nauseous: ["nausea"],
  puking: ["vomiting"],
  vomit: ["vomiting"],
  tired: ["fatigue", "weakness"],
  weak: ["weakness", "fatigue"],
  temperature: ["fever"],
  loose: ["diarrhea"],
  motion: ["diarrhea"],
  pee: ["urination", "urine"],
  breathless: ["breathlessness", "breathing"],
  breathing: ["breathlessness", "respiratory"],
  rash: ["skin"],
  toothache: ["tooth", "pain"],
};

function tokenize(text: string) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const baseTokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));

  return baseTokens.flatMap((token) => [token, ...(synonymMap[token] ?? [])]);
}

function buildDocumentText(document: HealthDocument) {
  return [
    document.condition,
    document.specialist,
    document.symptoms.join(" "),
    document.text,
    document.advice,
  ].join(" ");
}

function termFrequency(tokens: string[]) {
  const vector = new Map<string, number>();

  for (const token of tokens) {
    vector.set(token, (vector.get(token) ?? 0) + 1);
  }

  return vector;
}

function cosineSimilarity(
  queryVector: Map<string, number>,
  documentVector: Map<string, number>,
  idf: Map<string, number>
) {
  let dot = 0;
  let queryMagnitude = 0;
  let documentMagnitude = 0;

  for (const [term, queryCount] of queryVector) {
    const weight = idf.get(term) ?? 1;
    const queryValue = queryCount * weight;
    const documentValue = (documentVector.get(term) ?? 0) * weight;
    dot += queryValue * documentValue;
    queryMagnitude += queryValue ** 2;
  }

  for (const [term, documentCount] of documentVector) {
    const weight = idf.get(term) ?? 1;
    documentMagnitude += (documentCount * weight) ** 2;
  }

  if (!queryMagnitude || !documentMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(queryMagnitude) * Math.sqrt(documentMagnitude));
}

function phraseScore(symptoms: string, document: HealthDocument) {
  return document.symptoms.reduce((score, phrase) => {
    return symptoms.includes(phrase.toLowerCase())
      ? score + (phrase.includes(" ") ? 0.2 : 0.08)
      : score;
  }, 0);
}

export function getRagContext(symptoms: string): RagResult {
  const text = symptoms.toLowerCase().replace(/\s+/g, " ").trim();
  const documents = healthDocuments as HealthDocument[];
  const documentTokens = documents.map((document) =>
    tokenize(buildDocumentText(document))
  );
  const queryVector = termFrequency(tokenize(text));
  const documentVectors = documentTokens.map(termFrequency);

  const documentFrequency = new Map<string, number>();
  for (const tokens of documentTokens) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, count] of documentFrequency) {
    idf.set(term, Math.log((documents.length + 1) / (count + 1)) + 1);
  }

  const matches = documents
    .map((document, index) => {
      const vectorScore = cosineSimilarity(
        queryVector,
        documentVectors[index],
        idf
      );
      const score = vectorScore + phraseScore(text, document);

      return {
        id: document.id,
        condition: document.condition,
        specialist: document.specialist,
        urgency: document.urgency,
        advice: document.advice,
        score: Number(score.toFixed(3)),
      };
    })
    .filter((item) => item.score >= 0.15)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        urgencyRank[b.urgency ?? "normal"] - urgencyRank[a.urgency ?? "normal"]
      );
    });

  const best = matches[0] ?? defaultResult;
  const retrievedContext = matches
    .slice(0, 3)
    .map(
      (match, index) =>
        `${index + 1}. ${match.condition}
Specialist: ${match.specialist}
Urgency: ${match.urgency ?? "normal"}
Similarity score: ${match.score}
Advice: ${match.advice}`
    )
    .join("\n\n");

  const context = `
Retrieved local medical knowledge:
${retrievedContext || "No strong local match was found."}

Best knowledge base match:
Condition: ${best.condition}
Suggested specialist: ${best.specialist}
Basic advice: ${best.advice}
`.trim();

  return {
    matched: matches.length > 0,
    condition: best.condition,
    specialist: best.specialist,
    advice: best.advice,
    context,
    matches,
  };
}

export function buildRagOnlyModelData(rag: RagResult): string[] {
  return [
    "",
    "",
    `Knowledge base guidance: ${rag.condition}. ${rag.advice}`,
    `Recommended Specialist: ${rag.specialist}

**1. Consult a ${rag.specialist}**
Address: Nearby clinic or hospital based on your location
Rating: RAG fallback guidance
Website:`,
  ];
}
