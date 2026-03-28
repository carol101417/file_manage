process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.DATABASE_PATH = './test-security.sqlite';

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

describe('Security Tests', () => {
  test('Protected routes return 401 without token', async () => {
    const routes = [
      { method: 'get', path: '/api/auth/me' },
      { method: 'get', path: '/api/files' },
      { method: 'get', path: '/api/users' },
      { method: 'post', path: '/api/files/upload' },
      { method: 'post', path: '/api/auth/logout' },
    ];

    for (const route of routes) {
      const res = await request(app)[route.method](route.path);
      expect(res.status).toBe(401);
    }
  });

  test('Forged token returns 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer fake.token.here');
    expect(res.status).toBe(401);
  });

  test('Expired/invalid JWT returns 401', async () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign(
      { id: 1, username: 'admin', role: 'admin', jti: 'test-jti' },
      process.env.JWT_SECRET,
      { expiresIn: '0s' }
    );

    // Small delay to ensure expiry
    await new Promise(resolve => setTimeout(resolve, 1000));

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  test('Register endpoint requires admin auth', async () => {
    // Without token
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'hacker', password: 'Hack1234', role: 'admin' });
    expect(res1.status).toBe(401);

    // With regular user token
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin123!' });
    const adminToken = adminLogin.body.token;

    // Create a regular user first
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'regular', password: 'Regular1', role: 'user' });

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'regular', password: 'Regular1' });
    const userToken = userLogin.body.token;

    const res2 = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ username: 'hacker2', password: 'Hack1234', role: 'admin' });
    expect(res2.status).toBe(403);
  });

  test('Password complexity is enforced', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin123!' });
    const token = adminLogin.body.token;

    const weakPasswords = [
      { pw: '123', reason: 'too short' },
      { pw: 'abcdefgh', reason: 'no uppercase or number' },
      { pw: 'ABCDEFGH', reason: 'no lowercase or number' },
      { pw: 'Abcdefgh', reason: 'no number' },
      { pw: '12345678', reason: 'no letters' },
    ];

    for (const { pw } of weakPasswords) {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: `weak_${pw}`, password: pw, role: 'user' });
      expect(res.status).toBe(400);
    }
  });

  test('Health check is publicly accessible', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('SQL injection in login is prevented', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: "admin' OR '1'='1", password: "' OR '1'='1" });
    expect(res.status).toBe(401);
  });

  test('Username validation prevents special characters', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin123!' });
    const token = adminLogin.body.token;

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: '<script>alert(1)</script>', password: 'Test1234', role: 'user' });
    expect(res.status).toBe(400);
  });
});
