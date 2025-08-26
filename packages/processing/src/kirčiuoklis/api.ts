import ky from "ky";

type ApiRes = {
  code: number;
  /** JSON */
  message: string | false;
};

export type WordAccent = {
  accentInfo: {
    accented: string[];
    information: { mi: string }[];
  }[];
};

export type TextAccents = {
  textParts: {
    string: string;
    accented: string;
    accentType: "MULTIPLE_MEANING" | string;
    type: "WORD" | string;
  }[];
};

export async function fetchWordAccents(word: string) {
  const body = new FormData()
  body.append("action", "word_accent")
  body.append("nonce", "880129de2d")
  body.append("word", word)
  const res = await ky.post<ApiRes>("https://kalbu.vdu.lt/ajax-call", {
    body,
  });
  const jsonRes = (await res.json()) as ApiRes;
  if (jsonRes.code !== 200) {
    return Promise.reject(`Api Error (${jsonRes.code})`);
  }
  if (jsonRes.message === false) {
    return Promise.reject(`Api Error (${jsonRes.code})`);
  }
  return JSON.parse(jsonRes.message) as WordAccent;
}

export async function fetchTextAccents(text: string) {
  const body = new FormData()
  body.append("action", "text_accents")
  body.append("nonce", "880129de2d")
  body.append("body", text)
  const res = await ky.post<ApiRes>("https://kalbu.vdu.lt/ajax-call", {
    body,
  });
  const jsonRes = (await res.json()) as ApiRes;
  if (jsonRes.code !== 200) {
    return Promise.reject(`Api Error (${jsonRes.code})`);
  }
  if (jsonRes.message === false) {
    return Promise.reject(`Api Error (${jsonRes.code})`);
  }
  return JSON.parse(jsonRes.message) as TextAccents;
}
