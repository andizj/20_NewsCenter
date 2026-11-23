const { generateText, getConfig } = require('../src/services/llmService');

const ENV_KEYS = ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_TIMEOUT_MS'];

function okResponse(content) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}

describe('llmService', () => {
  const savedEnv = {};
  const realFetch = global.fetch;

  beforeEach(() => {
    ENV_KEYS.forEach(k => { savedEnv[k] = process.env[k]; delete process.env[k]; });
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    ENV_KEYS.forEach(k => {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    });
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  test('verwendet ohne Konfiguration lokales Ollama als Default', () => {
    expect(getConfig()).toEqual({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: '',
      model: 'llama3.2:3b',
      timeoutMs: 60000,
    });
  });

  test('sendet Anfrage an konfigurierten Anbieter mit API-Key und Modell', async () => {
    process.env.LLM_BASE_URL = 'https://api.example.com/v1/';
    process.env.LLM_API_KEY = 'secret-key';
    process.env.LLM_MODEL = 'some-model';
    global.fetch.mockResolvedValue(okResponse('  Kurze Zusammenfassung.  '));

    await expect(generateText('Hallo')).resolves.toBe('Kurze Zusammenfassung.');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer secret-key');
    expect(JSON.parse(options.body)).toEqual({
      model: 'some-model',
      messages: [{ role: 'user', content: 'Hallo' }],
    });
  });

  test('sendet keinen Authorization-Header ohne API-Key', async () => {
    global.fetch.mockResolvedValue(okResponse('Text'));
    await generateText('Hallo');
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  test.each([
    [401, /API-Key/],
    [403, /API-Key/],
    [404, /Modell/],
    [429, /Anfragelimit/],
    [500, /nicht verfügbar/],
  ])('wandelt HTTP %i in 503 mit passender Meldung um', async (status, message) => {
    global.fetch.mockResolvedValue({ ok: false, status, json: async () => ({}) });
    await expect(generateText('x')).rejects.toMatchObject({ status: 503, message: expect.stringMatching(message) });
  });

  test('meldet nicht erreichbaren Dienst als 503', async () => {
    global.fetch.mockRejectedValue(new TypeError('fetch failed'));
    await expect(generateText('x')).rejects.toMatchObject({ status: 503, message: 'KI-Dienst nicht erreichbar' });
  });

  test('meldet Timeout als 503', async () => {
    const err = new Error('timeout');
    err.name = 'TimeoutError';
    global.fetch.mockRejectedValue(err);
    await expect(generateText('x')).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/Timeout/) });
  });

  test('lehnt leere oder ungültige Antworten ab', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [] }) });
    await expect(generateText('x')).rejects.toMatchObject({ status: 503 });

    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError(); } });
    await expect(generateText('x')).rejects.toMatchObject({ status: 503 });
  });

  test('gibt den API-Key nie in Logs aus', async () => {
    process.env.LLM_API_KEY = 'top-secret';
    global.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(generateText('x')).rejects.toBeDefined();
    const logged = console.error.mock.calls.flat().join(' ');
    expect(logged).not.toContain('top-secret');
  });
});
