/* Мини-сервер без зависимостей (нужен Node.js 18+).
   Отдаёт index.html и принимает запросы к ИИ на /api/ai.
   API-ключ Gemini лежит ТОЛЬКО здесь, на сервере (файл .env), в браузер он не попадает. */
const http = require("http"), fs = require("fs"), path = require("path");

// читаем .env (формат: GEMINI_API_KEY=ваш_ключ)
try {
  for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const PORT = process.env.PORT || 3000;

// Промпты для каждого поля (правьте здесь)
const PROMPTS = {
  summary: "Перепиши текст «О себе» для резюме: красивый, живой, деловой стиль, 2–3 предложения. Исправь орфографию и пунктуацию. Не выдумывай факты, используй только то, что есть в тексте.",
  desc:    "Перепиши описание обязанностей и достижений для резюме: каждая мысль — с новой строки, начинай строку с «• », глаголы в прошедшем времени, кратко и конкретно. Исправь орфографию и пунктуацию. Не выдумывай факты.",
  skills:  "Приведи список навыков для резюме в порядок: исправь орфографию, регистр и написание названий технологий, убери повторы. Верни ТОЛЬКО навыки через запятую."
};

const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(fs.readFileSync(path.join(__dirname, "index.html")));
  }
  if (req.method === "POST" && req.url === "/api/ai") {
    let body = "";
    for await (const chunk of req) { body += chunk; if (body.length > 20000) return send(res, 413, { error: "Слишком длинный текст" }); }
    try {
      const { ai, text } = JSON.parse(body);
      if (!PROMPTS[ai] || typeof text !== "string" || !text.trim()) return send(res, 400, { error: "Неверный запрос" });
      if (!KEY) return send(res, 500, { error: "На сервере не задан GEMINI_API_KEY (файл .env)" });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: PROMPTS[ai] + "\nОтвет — только готовый текст на русском, без пояснений и кавычек.\n\nТекст:\n" + text.slice(0, 3000) }] }] })
      });
      const j = await r.json();
      if (!r.ok) return send(res, 502, { error: j.error?.message || "Ошибка Gemini" });
      const out = j.candidates?.[0]?.content?.parts?.map(p => p.text).join("").trim();
      return out ? send(res, 200, { text: out }) : send(res, 502, { error: "ИИ вернул пустой ответ" });
    } catch (e) { return send(res, 500, { error: "Ошибка сервера: " + e.message }); }
  }
  send(res, 404, { error: "Не найдено" });
}).listen(PORT, () => console.log(`Откройте http://localhost:${PORT}`));
