// Only loaded explicitly by the smoke test, NEVER in production.
globalThis.fetch = async (url, opts) => {
  if (!url.includes('generativelanguage.googleapis.com')) throw new Error('Unexpected mock URL');
  const req = JSON.parse(opts.body);
  const src = req.contents[0].parts[0].text;
  const text = src.includes('Отредактируй ВСЁ резюме')
    ? JSON.stringify({ summary: 'Отредактированный рассказ о кандидате.', skills: 'Excel, Power BI', experience: [{ index: 0, desc: '• Анализировал данные' }] })
    : 'Отредактированный текст.';
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
};
