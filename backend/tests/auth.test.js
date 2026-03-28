process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.DATABASE_PATH = './test-auth.sqlite';

const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Clean up test db before starting
const dbPath = path.join(__dirname, '..', process.env.DATABASE_PATH);
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const app = require('../src/app');

afterAll(() => {
  try { require('../src/config/database').db.close(); } catch(e) {}
  try { fs.unlinkSync(dbPath); } catch(e) {}
});

describe('Auth API', () => {
  let token;

  test('POST /api/auth/login - successful login with default admin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('admin');
    expect(res.body.user.role).toBe('admin');
    token = res.body.token;
  });

  test('POST /api/auth/login - wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('POST /api/auth/login - missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login - non-existent user returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: 'Admin123!' });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me - returns current user info', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('admin');
  });

  test('GET /api/auth/me - no token returns 401', async () => {
    const res = await request(app)
      .get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/logout - invalidates token', async () => {
    // First login to get a fresh token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin123!' });
    const logoutToken = loginRes.body.token;

    // Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${logoutToken}`);
    expect(logoutRes.status).toBe(200);

    // Try to use the old token - should be revoked
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${logoutToken}`);
    expect(meRes.status).toBe(401);
    expect(meRes.body.error).toBe('Token has been revoked');
  });
});
