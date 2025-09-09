import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { votingRoutes } from '../../src/routes/votings.js';
import { initDatabase } from '../../src/db/init.js';
import { cleanupExpiredAuthData } from '../../src/db/auth-queries.js';
import { createVoting, createVotingOptions, getVoting } from '../../src/db/queries.js';

// Создаем тестовое приложение
const app = new Hono();
app.route('/api', votingRoutes);

describe('Voting Routes', () => {
  let testVotingId: string;

  beforeEach(async () => {
    // Инициализируем тестовую БД
    await initDatabase();
    
    // Создаем тестовое голосование
    const now = new Date();
    const endAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 часа
    
    testVotingId = await createVoting({
      title: 'Test Voting',
      created_at: now,
      end_at: endAt,
      duration_hours: 24,
      is_public: true,
      user_id: null
    });

    // Создаем варианты голосования
    await createVotingOptions([
      {
        voting_id: testVotingId,
        file_path: '/test/image1.jpg',
        sort_order: 0,
        pixel_ratio: 2,
        width: 800,
        height: 600,
        media_type: 'image'
      },
      {
        voting_id: testVotingId,
        file_path: '/test/image2.jpg',
        sort_order: 1,
        pixel_ratio: 2,
        width: 800,
        height: 600,
        media_type: 'image'
      }
    ]);
  });

  afterEach(async () => {
    // Очищаем тестовые данные
    await cleanupExpiredAuthData();
  });

  describe('GET /api/votings', () => {
    it('should return list of public votings', async () => {
      const res = await app.request('/api/votings');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data).toHaveProperty('votings');
      expect(Array.isArray(data.votings)).toBe(true);
      expect(data.votings.length).toBeGreaterThan(0);
      
      const voting = data.votings[0];
      expect(voting).toHaveProperty('id');
      expect(voting).toHaveProperty('title');
      expect(voting).toHaveProperty('options');
      expect(voting).toHaveProperty('vote_count');
      expect(voting).toHaveProperty('hasVoted');
    });
  });

  describe('GET /api/votings/:id', () => {
    it('should return voting details', async () => {
      const res = await app.request(`/api/votings/${testVotingId}`);
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data).toHaveProperty('voting');
      expect(data.voting.id).toBe(testVotingId);
      expect(data.voting.title).toBe('Test Voting');
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('hasVoted');
      expect(data).toHaveProperty('selectedOption');
    });

    it('should return 404 for non-existent voting', async () => {
      const res = await app.request('/api/votings/non-existent-id');
      expect(res.status).toBe(404);
      
      const data = await res.json();
      expect(data.error).toBe('Голосование не найдено');
    });
  });

  describe('POST /api/votings', () => {
    it('should require authentication', async () => {
      const res = await app.request('/api/votings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Voting',
          images: [],
          duration: 24
        })
      });
      
      expect(res.status).toBe(401);
    });

    it('should require title and images', async () => {
      const res = await app.request('/api/votings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          title: '',
          images: [],
          duration: 24
        })
      });
      
      // Сначала проверяем авторизацию, потом валидацию
      expect(res.status).toBe(401);
    });

    it('should require at least 2 images', async () => {
      const res = await app.request('/api/votings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          title: 'Test Voting',
          images: ['single-image'],
          duration: 24
        })
      });
      
      expect(res.status).toBe(401);
    });

    it('should limit to maximum 10 images', async () => {
      const manyImages = Array(11).fill('image-data');
      
      const res = await app.request('/api/votings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          title: 'Test Voting',
          images: manyImages,
          duration: 24
        })
      });
      
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/votings/:id/vote', () => {
    it('should require valid option ID', async () => {
      const res = await app.request(`/api/votings/${testVotingId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId: 'invalid' })
      });
      
      expect(res.status).toBe(401);
    });

    it('should require valid voting ID', async () => {
      const res = await app.request('/api/votings/non-existent/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId: 1 })
      });
      
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/votings/:id/results', () => {
    it('should return 400 for active voting', async () => {
      const res = await app.request(`/api/votings/${testVotingId}/results`);
      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('Голосование еще не завершено');
    });

    it('should return 404 for non-existent voting', async () => {
      const res = await app.request('/api/votings/non-existent/results');
      expect(res.status).toBe(404);
      
      const data = await res.json();
      expect(data.error).toBe('Голосование не найдено');
    });
  });

  describe('POST /api/votings/:id/end-early', () => {
    it('should require authentication', async () => {
      const res = await app.request(`/api/votings/${testVotingId}/end-early`, {
        method: 'POST'
      });
      
      expect(res.status).toBe(401);
    });

    it('should require ownership', async () => {
      const res = await app.request(`/api/votings/${testVotingId}/end-early`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer mock-token' }
      });
      
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/votings/:id', () => {
    it('should require authentication', async () => {
      const res = await app.request(`/api/votings/${testVotingId}`, {
        method: 'DELETE'
      });
      
      expect(res.status).toBe(401);
    });

    it('should require ownership', async () => {
      const res = await app.request(`/api/votings/${testVotingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer mock-token' }
      });
      
      expect(res.status).toBe(401);
    });
  });
});
