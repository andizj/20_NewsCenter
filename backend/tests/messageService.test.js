jest.mock('../src/repositories/messageRepository');
jest.mock('../src/services/llmService');

const messageRepository = require('../src/repositories/messageRepository');
const llmService = require('../src/services/llmService');
const { createMessage, getMessageById, addTagToMessage, addTagsToMessage, summarizeMessage } = require('../src/services/messageService');

describe('messageService', () => {

  beforeEach(() => jest.clearAllMocks());

  describe('createMessage', () => {
    test('wirft Fehler wenn Titel oder Body fehlt', async () => {
      await expect(createMessage({ authorId: '1', title: '', body: 'text' }))
        .rejects.toMatchObject({ status: 400 });

      await expect(createMessage({ authorId: '1', title: 'Titel', body: '' }))
        .rejects.toMatchObject({ status: 400 });
    });

    test('erstellt Nachricht mit gültiger targetRole', async () => {
      const fakeMessage = { id: 'msg-1', title: 'Hallo', body: 'Welt' };
      messageRepository.create.mockResolvedValue(fakeMessage);

      const result = await createMessage({ authorId: '1', title: 'Hallo', body: 'Welt', targetRole: 'STUDENT' });
      expect(result).toEqual(fakeMessage);
      expect(messageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ targetRole: 'STUDENT' })
      );
    });

    test('setzt targetRole auf ALL wenn ungültig', async () => {
      messageRepository.create.mockResolvedValue({});

      await createMessage({ authorId: '1', title: 'Test', body: 'Text', targetRole: 'UNKNOWN' });
      expect(messageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ targetRole: 'ALL' })
      );
    });
  });

  describe('addTagsToMessage (max. 3 Themen)', () => {
    test('weist bis zu 3 Themen in einem Schritt zu', async () => {
      messageRepository.countTags.mockResolvedValue(0);
      messageRepository.addTags.mockResolvedValue([{}, {}, {}]);

      await addTagsToMessage('msg-1', ['t1', 't2', 't3']);
      expect(messageRepository.addTags).toHaveBeenCalledWith('msg-1', ['t1', 't2', 't3']);
    });

    test('entfernt doppelte IDs vor dem Speichern', async () => {
      messageRepository.countTags.mockResolvedValue(0);
      messageRepository.addTags.mockResolvedValue([{}, {}]);

      await addTagsToMessage('msg-1', ['t1', 't1', 't2']);
      expect(messageRepository.addTags).toHaveBeenCalledWith('msg-1', ['t1', 't2']);
    });

    test('lehnt mehr als 3 Themen ab', async () => {
      await expect(addTagsToMessage('msg-1', ['t1', 't2', 't3', 't4']))
        .rejects.toMatchObject({ status: 400 });
      expect(messageRepository.addTags).not.toHaveBeenCalled();
    });

    test('lehnt ab, wenn zusammen mit bestehenden Themen mehr als 3 entstehen', async () => {
      messageRepository.countTags.mockResolvedValue(2);

      await expect(addTagsToMessage('msg-1', ['t3', 't4']))
        .rejects.toMatchObject({ status: 400 });
      expect(messageRepository.addTags).not.toHaveBeenCalled();
    });

    test.each([
      ['leere Liste', []],
      ['keine Liste', 't1'],
      ['leere ID', ['t1', '']],
      ['keine Zeichenkette', [42]],
    ])('lehnt %s ab', async (_label, input) => {
      await expect(addTagsToMessage('msg-1', input)).rejects.toMatchObject({ status: 400 });
    });

    test('meldet 409, wenn ein Thema schon zugewiesen ist', async () => {
      messageRepository.countTags.mockResolvedValue(0);
      messageRepository.addTags.mockRejectedValue({ code: '23505' });

      await expect(addTagsToMessage('msg-1', ['t1'])).rejects.toMatchObject({ status: 409 });
    });

    test('auch die Einzelzuweisung respektiert das Limit', async () => {
      messageRepository.countTags.mockResolvedValue(3);

      await expect(addTagToMessage('msg-1', 't4')).rejects.toMatchObject({ status: 400 });
      expect(messageRepository.addTag).not.toHaveBeenCalled();
    });
  });

  describe('getMessageById', () => {
    test('gibt Nachricht zurück wenn gefunden', async () => {
      const fakeMessage = { id: 'msg-1', title: 'Test' };
      messageRepository.findById.mockResolvedValue(fakeMessage);

      const result = await getMessageById({ id: 'msg-1', userRole: 'STUDENT' });
      expect(result).toEqual(fakeMessage);
    });

    test('wirft 404 wenn Nachricht nicht existiert', async () => {
      messageRepository.findById.mockResolvedValue(null);

      await expect(getMessageById({ id: 'gibts-nicht', userRole: 'STUDENT' }))
        .rejects.toMatchObject({ status: 404 });
    });
  });

  describe('summarizeMessage', () => {
    test('wirft 404 wenn Nachricht für die Rolle nicht sichtbar ist', async () => {
      messageRepository.findById.mockResolvedValue(null);
      await expect(summarizeMessage({ id: 'msg-1', userRole: 'STUDENT' }))
        .rejects.toMatchObject({ status: 404 });
      expect(llmService.generateText).not.toHaveBeenCalled();
    });

    test('übergibt Titel und Text an den LLM-Service', async () => {
      messageRepository.findById.mockResolvedValue({ id: 'msg-1', title: 'Übung', body: 'Morgen 10 Uhr' });
      llmService.generateText.mockResolvedValue('Morgen um 10 Uhr findet eine Übung statt.');

      await expect(summarizeMessage({ id: 'msg-1', userRole: 'STUDENT' }))
        .resolves.toEqual({ summary: 'Morgen um 10 Uhr findet eine Übung statt.' });

      const prompt = llmService.generateText.mock.calls[0][0];
      expect(prompt).toContain('Übung');
      expect(prompt).toContain('Morgen 10 Uhr');
    });

    test('reicht Fehler des LLM-Service durch', async () => {
      messageRepository.findById.mockResolvedValue({ id: 'msg-1', title: 'T', body: 'B' });
      llmService.generateText.mockRejectedValue({ status: 503, message: 'KI-Dienst nicht erreichbar' });
      await expect(summarizeMessage({ id: 'msg-1', userRole: 'ALL' }))
        .rejects.toMatchObject({ status: 503 });
    });
  });

});
