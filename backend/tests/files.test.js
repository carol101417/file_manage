process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.DATABASE_PATH = './test-files.sqlite';

const request = require('supertest');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', process.env.DATABASE_PATH);
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const app = require('../src/app');

// Create a temp test file
const testFilePath = path.join(__dirname, 'test-upload.txt');
const testExePath = path.join(__dirname, 'test-upload.exe');

beforeAll(() => {
  fs.writeFileSync(testFilePath, 'Hello, this is a test file for upload testing.');
  fs.writeFileSync(testExePath, 'fake exe content');
});

afterAll(() => {
  try { require('../src/config/database').db.close(); } catch(e) {}
  try { fs.unlinkSync(dbPath); } catch(e) {}
  try { fs.unlinkSync(testFilePath); } catch(e) {}
  try { fs.unlinkSync(testExePath); } catch(e) {}
  // Clean up uploaded files in uploads dir
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    files.forEach(f => {
      if (f !== '.gitkeep') {
        try { fs.unlinkSync(path.join(uploadsDir, f)); } catch(e) {}
      }
    });
  }
});

describe('File API', () => {
  let token;
  let uploadedFileId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin123!' });
    token = res.body.token;
  });

  test('POST /api/files/upload - upload file successfully', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', testFilePath);
    expect(res.status).toBe(201);
    expect(res.body.file.fileId).toBeDefined();
    expect(res.body.file.originalName).toBe('test-upload.txt');
    uploadedFileId = res.body.file.fileId;
  });

  test('POST /api/files/upload - .exe file rejected', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', testExePath);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('.exe');
  });

  test('POST /api/files/upload - no file returns 400', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('GET /api/files - returns paginated file list', async () => {
    const res = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.files).toBeDefined();
    expect(res.body.total).toBeDefined();
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBeDefined();
    expect(Array.isArray(res.body.files)).toBe(true);
  });

  test('GET /api/files - pagination works', async () => {
    const res = await request(app)
      .get('/api/files?page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(10);
  });

  test('GET /api/files/search - search files', async () => {
    const res = await request(app)
      .get('/api/files/search?keyword=test-upload')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.files.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/files/search - missing keyword returns 400', async () => {
    const res = await request(app)
      .get('/api/files/search')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('GET /api/files/:fileId - get file details', async () => {
    const res = await request(app)
      .get(`/api/files/${uploadedFileId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.file_id).toBe(uploadedFileId);
  });

  test('GET /api/files/:fileId/share-link - get share link', async () => {
    const res = await request(app)
      .get(`/api/files/${uploadedFileId}/share-link`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.shareLink).toContain(uploadedFileId);
  });

  test('GET /api/files/:fileId/download - download file', async () => {
    const res = await request(app)
      .get(`/api/files/${uploadedFileId}/download`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/files/:fileId/public-download - public download', async () => {
    const res = await request(app)
      .get(`/api/files/${uploadedFileId}/public-download`);
    expect(res.status).toBe(200);
  });

  test('GET /api/files/:fileId/logs - get download logs', async () => {
    const res = await request(app)
      .get(`/api/files/${uploadedFileId}/logs`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('DELETE /api/files/:fileId - delete file', async () => {
    const res = await request(app)
      .delete(`/api/files/${uploadedFileId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Verify file is gone
    const getRes = await request(app)
      .get(`/api/files/${uploadedFileId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  test('GET /api/files - no auth returns 401', async () => {
    const res = await request(app).get('/api/files');
    expect(res.status).toBe(401);
  });
});
