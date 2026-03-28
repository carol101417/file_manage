process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.DATABASE_PATH = './test-users.sqlite';

const request = require('supertest');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', process.env.DATABASE_PATH);
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const app = require('../src/app');

afterAll(() => {
  try { require('../src/config/database').db.close(); } catch(e) {}
  try { fs.unlinkSync(dbPath); } catch(e) {}
});

describe('User Management API', () => {
  let adminToken;
  let userToken;
  let createdUserId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin123!' });
    adminToken = res.body.token;
  });

  test('POST /api/users - create user successfully', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'testuser', password: 'Test1234', role: 'user' });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBeDefined();
    createdUserId = res.body.userId;
  });

  test('POST /api/users - weak password rejected', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'weakuser', password: '123', role: 'user' });
    expect(res.status).toBe(400);
  });

  test('POST /api/users - password without uppercase rejected', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'weakuser', password: 'testtest1', role: 'user' });
    expect(res.status).toBe(400);
  });

  test('POST /api/users - duplicate username rejected', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'testuser', password: 'Test1234', role: 'user' });
    expect(res.status).toBe(409);
  });

  test('POST /api/users - non-admin cannot create user', async () => {
    // Login as regular user
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'Test1234' });
    userToken = loginRes.body.token;

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ username: 'another', password: 'Test1234', role: 'user' });
    expect(res.status).toBe(403);
  });

  test('GET /api/users - admin can list users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  test('GET /api/users - non-admin cannot list users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  test('PUT /api/users/change-password - change own password', async () => {
    const res = await request(app)
      .put('/api/users/change-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ currentPassword: 'Test1234', newPassword: 'NewPass123' });
    expect(res.status).toBe(200);
  });

  test('PUT /api/users/change-password - wrong current password', async () => {
    // Re-login with new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'NewPass123' });
    userToken = loginRes.body.token;

    const res = await request(app)
      .put('/api/users/change-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ currentPassword: 'WrongPass1', newPassword: 'Another123' });
    expect(res.status).toBe(401);
  });

  test('DELETE /api/users/:id - admin cannot delete self', async () => {
    // Get admin user id
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminId = meRes.body.id;

    const res = await request(app)
      .delete(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('DELETE /api/users/:id - admin can delete other user', async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
