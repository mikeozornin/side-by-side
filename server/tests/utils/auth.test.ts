import { describe, it, expect, beforeEach } from 'bun:test';
import {
  generateMagicToken,
  generateFigmaCode,
  hashToken,
  verifyToken,
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateId
} from '../../src/utils/auth.js';

describe('Auth Utils', () => {
  describe('generateMagicToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateMagicToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateMagicToken();
      const token2 = generateMagicToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateFigmaCode', () => {
    it('should generate a code with FGM- prefix', () => {
      const code = generateFigmaCode();
      expect(code).toMatch(/^FGM-[A-Z0-9]{6}$/);
    });

    it('should generate unique codes', () => {
      const code1 = generateFigmaCode();
      const code2 = generateFigmaCode();
      expect(code1).not.toBe(code2);
    });
  });

  describe('generateId', () => {
    it('should generate a 32-character hex string', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('token hashing and verification', () => {
    const testToken = 'test-token-123';

    it('should hash and verify tokens correctly', async () => {
      const hash = await hashToken(testToken);
      expect(hash).not.toBe(testToken);
      expect(hash).toMatch(/^\$2[aby]\$10\$/);

      const isValid = await verifyToken(testToken, hash);
      expect(isValid).toBe(true);
    });

    it('should reject invalid tokens', async () => {
      const hash = await hashToken(testToken);
      const isValid = await verifyToken('wrong-token', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT tokens', () => {
    const testUserId = 'test-user-id';
    const testEmail = 'test@example.com';
    const testSessionId = 'test-session-id';

    describe('access tokens', () => {
      it('should create and verify access tokens', () => {
        const token = createAccessToken({
          userId: testUserId,
          email: testEmail
        });

        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

        const payload = verifyAccessToken(token);
        expect(payload).toMatchObject({
          userId: testUserId,
          email: testEmail,
          type: 'access'
        });
      });

      it('should reject invalid access tokens', () => {
        const payload = verifyAccessToken('invalid-token');
        expect(payload).toBeNull();
      });

      it('should reject refresh tokens as access tokens', () => {
        const refreshToken = createRefreshToken({
          sessionId: testSessionId,
          userId: testUserId
        });

        const payload = verifyAccessToken(refreshToken);
        expect(payload).toBeNull();
      });
    });

    describe('refresh tokens', () => {
      it('should create and verify refresh tokens', () => {
        const token = createRefreshToken({
          sessionId: testSessionId,
          userId: testUserId
        });

        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);

        const payload = verifyRefreshToken(token);
        expect(payload).toMatchObject({
          sessionId: testSessionId,
          userId: testUserId,
          type: 'refresh'
        });
      });

      it('should reject invalid refresh tokens', () => {
        const payload = verifyRefreshToken('invalid-token');
        expect(payload).toBeNull();
      });

      it('should reject access tokens as refresh tokens', () => {
        const accessToken = createAccessToken({
          userId: testUserId,
          email: testEmail
        });

        const payload = verifyRefreshToken(accessToken);
        expect(payload).toBeNull();
      });
    });
  });
});
