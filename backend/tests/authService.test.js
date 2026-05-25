process.env.JWT_SECRET = 'test-secret';

const { hashPassword, comparePassword, generateToken } = require('../src/services/authService');
const jwt = require('jsonwebtoken');

describe('authService', () => {

  describe('hashPassword / comparePassword', () => {
    test('hashed password matches original', async () => {
      const hash = await hashPassword('meinPasswort123');
      const result = await comparePassword('meinPasswort123', hash);
      expect(result).toBe(true);
    });

    test('wrong password does not match', async () => {
      const hash = await hashPassword('meinPasswort123');
      const result = await comparePassword('falschesPasswort', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    const user = { id: 'abc-123', email: 'test@example.com', role: 'STUDENT' };

    test('returns a valid JWT', () => {
      const token = generateToken(user);
      const decoded = jwt.verify(token, 'test-secret');
      expect(decoded.userId).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
    });

    test('token contains expiry', () => {
      const token = generateToken(user);
      const decoded = jwt.decode(token);
      expect(decoded.exp).toBeDefined();
    });
  });

});
