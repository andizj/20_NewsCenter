jest.mock('../src/repositories/tagRepository');
jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const tagRepository = require('../src/repositories/tagRepository');
const { suggestTags } = require('../src/services/tagSuggestionService');

const tagsFixture = [
  { id: 'tag-general', name: 'general', description: null, subscriberCount: 1 },
  { id: 'tag-it', name: 'it', description: 'IT updates', subscriberCount: 12 },
  { id: 'tag-events', name: 'events', description: 'Events & meetups', subscriberCount: 5 },
  { id: 'tag-brand', name: 'Brand', description: 'Fire & evacuation', subscriberCount: 400 },
];

describe('tagSuggestionService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockRejectedValue(new Error('thesaurus offline'));
    tagRepository.findAllWithSubscriberCount.mockResolvedValue(tagsFixture);
  });

  describe('suggestTags', () => {
    test('wirft 400 wenn Titel und Body fehlen', async () => {
      await expect(suggestTags({ title: '', body: '' }))
        .rejects.toMatchObject({ status: 400 });
      await expect(suggestTags({}))
        .rejects.toMatchObject({ status: 400 });

      expect(tagRepository.findAllWithSubscriberCount).not.toHaveBeenCalled();
    });

    test('schlägt passende bestehende Tags mit subscriberCount vor', async () => {
      const result = await suggestTags({
        title: 'Events meetup',
        body: 'Join the events meetup tomorrow.',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'tag-events',
        name: 'events',
        subscriberCount: 5,
      });
      expect(result[0].reason).toMatch(/message text/i);
    });

    test('schlägt Tag über Thesaurus-Synonyme vor (fallback-fähig)', async () => {
      axios.get.mockResolvedValue({
        data: {
          synsets: [{ terms: [{ term: 'events' }, { term: 'Veranstaltung' }] }],
        },
      });

      const result = await suggestTags({
        title: 'Feier',
        body: 'Die Veranstaltung findet im Buero statt.',
      });

      const events = result.find((tag) => tag.id === 'tag-events');
      expect(events).toBeDefined();
      expect(events.subscriberCount).toBe(5);
      expect(events.reason).toBe('Matched by synonym or related term');
    });

    test('gibt leere Liste zurück wenn nichts passt', async () => {
      const result = await suggestTags({
        title: 'Sunrise',
        body: 'Nothing relevant in here.',
      });

      expect(result).toEqual([]);
    });

    test('findet Plural-Varianten des Tag-Namens', async () => {
      const result = await suggestTags({
        title: 'Semester start',
        body: 'A new event for all students.',
      });

      expect(result.map((tag) => tag.id)).toContain('tag-events');
    });

    test('sortiert bei gleichem Score nach subscriberCount', async () => {
      tagRepository.findAllWithSubscriberCount.mockResolvedValue([
        { id: 'tag-small', name: 'meetup', description: null, subscriberCount: 2 },
        { id: 'tag-big', name: 'events', description: null, subscriberCount: 50 },
      ]);

      const result = await suggestTags({
        title: 'events meetup',
        body: 'events meetup',
      });

      expect(result.map((tag) => tag.id)).toEqual(['tag-big', 'tag-small']);
      expect(result[0].subscriberCount).toBe(50);
    });

    test('liefert auch ohne erreichbaren Thesaurus direkte Treffer', async () => {
      axios.get.mockRejectedValue(new Error('timeout'));

      const result = await suggestTags({
        title: 'Fire drill',
        body: 'Brand alarm today.',
      });

      expect(result.map((tag) => tag.id)).toContain('tag-brand');
      expect(axios.get).toHaveBeenCalled();
    });
  });

  describe('suggestTags – neue Tags', () => {
    test('schlägt neue Tags vor, wenn kein bestehender Tag passt', async () => {
      const result = await suggestTags({
        title: 'Exam registration opens',
        body: 'Please register for the exam before the deadline ends.',
      });

      expect(result).toHaveLength(3);
      expect(result.every((entry) => entry.type === 'new')).toBe(true);
      expect(result.every((entry) => entry.subscriberCount === 0)).toBe(true);
      expect(result.every((entry) => entry.id === undefined)).toBe(true);

      const names = result.map((entry) => entry.name);
      expect(names).toEqual(expect.arrayContaining(['exam', 'registration', 'deadline']));
      expect(result[0].reason).toBe('Detected relevant keyword');
    });

    test('bevorzugt bestehende Tags und lässt neue Tags dann weg', async () => {
      const result = await suggestTags({
        title: 'Events workshop',
        body: 'Join the events workshop next week.',
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((entry) => entry.type === 'existing')).toBe(true);
      expect(result.map((entry) => entry.name)).toContain('events');
    });

    test('kurze Keywords wie "lab" werden nur bei Grossschreibung vorgeschlagen', async () => {
      const upper = await suggestTags({
        title: 'Lab safety',
        body: 'The lab will be closed for maintenance.',
      });
      expect(upper.map((entry) => entry.name)).toContain('lab');

      const lower = await suggestTags({
        title: 'Safety notes',
        body: 'The lab will be closed.',
      });
      expect(lower).toEqual([]);
    });

    test('leere Vorschläge, wenn nur Füllwörter im Text stehen', async () => {
      const result = await suggestTags({
        title: 'Please note',
        body: 'This is a short message for everyone.',
      });

      expect(result).toEqual([]);
    });

    test('schlägt bestehende Tags vor, wenn der Keyword-Name existiert', async () => {
      tagRepository.findAllWithSubscriberCount.mockResolvedValue([
        { id: 'tag-security', name: 'security', description: null, subscriberCount: 7 },
      ]);

      const result = await suggestTags({
        title: 'Security hint',
        body: 'The security team updated the rules.',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'existing',
        id: 'tag-security',
        name: 'security',
        subscriberCount: 7,
      });
    });
  });

});
