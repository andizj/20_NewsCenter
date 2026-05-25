jest.mock('../src/repositories/messageRepository');

const messageRepository = require('../src/repositories/messageRepository');
const { createMessage, getMessageById } = require('../src/services/messageService');

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

});
