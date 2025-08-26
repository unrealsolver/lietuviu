import ky from "ky";

type TranslateRequest = {
  q: string;
  source: string;
  target: string;
  format: "text" | "html";
  alternatives: number;
}

export type TranslateResponse = {
  alternatives: string[];
  detectedLanguage: {
    confidence: number;
    language: string;
  };
  translatedText: string;
}

export async function fetchTranslate(word: string) {
  return ky.post<TranslateResponse>("http://localhost:5000/translate", {
    body: JSON.stringify({
      q: word,
      source: "lt",
      target: "ru",
      format: "text",
      alternatives: 2,
    } satisfies TranslateRequest),
    headers: {
      "Content-Type": "application/json",
    }
  }).then(async (res) => {
    return await res.json();
  },async (reason) => {
    const res = await reason.response.json()
    console.error(res.error)
    return Promise.reject(res.error)
  })
}
