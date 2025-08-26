import BankPrototypeSchema from "./schemas/BankPrototype.schema.json";
import type { BankPrototype, ModeStress, ModeTranslate } from "./types";
import ProgressBars from "@zhangfuxing/multi-progress";
import { eachSeries, mapLimit, all } from "async-es";
import { compileSchema } from "json-schema-library";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { exists, readdir, readFile, writeFile } from "node:fs/promises";
import { env, exit } from "node:process";
import { inspect } from "node:util";
import { handler as accentHandler, WordAccent, TextAccents } from "./kirčiuoklis";
import { handler as translateHandler, TranslateResponse } from "./translate";
import type {Events, Handler, Mode, Context, RawData} from "./handler";

const OUT_DIR = "../databanks/dist";
const IN_DIR = "../databanks/sources";

const mswHandlers = [
  http.post("https://kalbu.vdu.lt/ajax-call", async (info) => {
    await new Promise((resolve) => setTimeout(resolve, 50))
    const req = info.request
    const txt = await req.text()
    const message = txt.includes('word_accent')
      ? '{"accentInfo":[{"accented":["var\u0303le"],"information":[{"mi":"dkt., mot. g., vns. \u0161auksm."}]},{"accented":["varle\u0300"],"information":[{"mi":"dkt., mot. g., vns. \u012fnag."}]}]}'
      : '{"textParts":[{"string":"a\u010di\u016b","accented":"a\u0303\u010di\u016b","accentType":"ONE","type":"WORD"}]}'
    return HttpResponse.json({
      code: 200,
      message
    })
  })
];

const bankSchema = compileSchema(BankPrototypeSchema);

async function openBank(fname: string) {
  const bank = JSON.parse(
    await readFile(`${IN_DIR}/${fname}`, "utf8"),
  ) as BankPrototype;
  const { valid, errors } = bankSchema.validate(bank);

  if (!valid) {
    console.error(inspect(errors, false, 10));
    return 1;
  }

  const total = bank.data.length;
  const bars = new ProgressBars({
    title: "3rd party API processing",
  });

  const _bars = {}

  function onProgress(text: string, completed: number) {
    _bars[text] = {
      total,
      completed,
      text,
    }
    
    bars.render(Object.values(_bars).sort((a, b) => a.text.localeCompare(b.text)));
  }

  const events: Events = {
    onProgress
  }

  // TODO iterate over modes
  const data = await Promise.all([
    handle(getHandler(bank.modes[0]), bank, bank.modes[0], events),
    handle(getHandler(bank.modes[1]), bank, bank.modes[1], events),
  ])
  bars.end()

  const [_translations, _accents] = data

  const translate: RawData<TranslateResponse>[] = _translations
  const accents: RawData<{word: WordAccent, text: TextAccents}>[] = _accents

  const translateIndex = translate.reduce((m, d) => {
    m[d.word] = d.data
    return m
  }, {} as Record<string, TranslateResponse>)

  const accentIndex = accents.reduce((m, d) => {
    m[d.word] = d.data
    return m
  }, {} as Record<string, {word: WordAccent, text: TextAccents}>)

  const newData = bank.data.map((d) => {
    return {
      word: d,
      accent: accentIndex[d]?.text.textParts[0]?.accented,
      translate: {
        rus: translateIndex[d]?.translatedText
      }
    }
  })
  const out = {...bank, data: newData}
  const [fnameNoExt, ..._] = fname.split('.')
  await writeFile(`${OUT_DIR}/${fnameNoExt}.bank.json`, JSON.stringify(out, null, 2))
}

function getHandler<T>(mode: Mode): Handler<T> {
  if (mode.name === "stresses") {
    return accentHandler
  } else if (mode.name === "translate") {
    return translateHandler
  } else {
    throw new Error(`No handler for type ${mode.name}`)
  }
}

async function handle<T>(handler: Handler<T>, bank: BankPrototype, mode: Mode, events: Events) {
  const context: Context = {
    bank,
    mode,
    cache: []
  }

  const fname = `${handler.name}.log.json`

  if (await exists(`${OUT_DIR}/${fname}`)) {
    console.log(`Cache found: ${fname}`)
    const content = await readFile(`${OUT_DIR}/${fname}`, 'utf8')
    context.cache = JSON.parse(content)
  }

  try {
    const data = await handler.handle(context, events)
    await writeFile(`${OUT_DIR}/${fname}`, JSON.stringify(data, null, 2))
    return data
  } catch {
    console.error('Error')
  }
}

async function main() {
  const files = await readdir(IN_DIR);
  await eachSeries(files, openBank);

  return 0;
}

if (env.DEBUG) {
  const server = setupServer(...mswHandlers);
  server.listen();
}

exit(await main());
