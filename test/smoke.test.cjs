const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
async function getPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
async function runServer(fake) {
  const port = await getPort();
  const env = { ...process.env, PORT: String(port), GEMINI_MODEL: 'gemini-3.5-flash-lite', GEMINI_API_KEY: fake ? 'fake-test-key' : '' };
  const args = fake ? ['-r', path.join(__dirname, 'mock-gemini.cjs'), 'server.js'] : ['server.js'];
  const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Server exited before readiness');
    try { const r = await fetch(origin + '/api/status'); if (r.ok) return { child, origin }; }
    catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  child.kill();
  throw new Error('Server did not start');
}
async function post(origin, body) {
  const res = await fetch(origin + '/api/ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return { code: res.status, body: await res.json() };
}
test('Без API-ключа сервер работает, а ИИ честно недоступен', async () => {
  const { child, origin } = await runServer(false);
  try {
    const home = await fetch(origin + '/');
    assert.equal(home.status, 200);
    const state = await (await fetch(origin + '/api/status')).json();
    assert.equal(state.keyConfigured, false);
    const r = await post(origin, { ai: 'summary', text: 'Работал аналитиком' });
    assert.equal(r.code, 503);
    assert.match(r.body.error, /GEMINI_API_KEY/);
  } finally { child.kill(); }
});
test('С тестовым Gemini: поле и всё резюме обрабатываются корректно', async () => {
  const { child, origin } = await runServer(true);
  try {
    const state = await (await fetch(origin + '/api/status')).json();
    assert.equal(state.keyConfigured, true);
    const field = await post(origin, { ai: 'summary', text: 'Работал аналитиком' });
    assert.equal(field.code, 200);
    assert.equal(field.body.text, 'Отредактированный текст.');
    const resume = await post(origin, {
      ai: 'resume', resume: { title: 'Аналитик', summary: 'Люблю аналитику', skills: 'exсel,power bi', experience: [{ desc: 'Делал отчеты' }] }
    });
    assert.equal(resume.code, 200);
    assert.equal(resume.body.resume.summary, 'Отредактированный рассказ о кандидате.');
    assert.deepEqual(resume.body.resume.experience, [{ index: 0, desc: '• Анализировал данные' }]);
    assert.equal(resume.body.resume.skills, 'Excel, Power BI');
    const malformed = await post(origin, { ai: 'resume', resume: { skills: 'Excel' } });
    assert.equal(malformed.code, 400);
  } finally { child.kill(); }
});
