import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('token');
      if (token) {
        // Token expired or revoked - clean up
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Use a custom event to notify the app
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }
    return Promise.reject(error);
  }
);

export default {
  // Auth
  login(username, password) {
    return api.post('/auth/login', { username, password });
  },
  logout() {
    return api.post('/auth/logout');
  },
  register(username, password, role) {
    return api.post('/auth/register', { username, password, role });
  },
  getMe() {
    return api.get('/auth/me');
  },

  // Files
  uploadFile(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    });
  },
  getFiles(page = 1, pageSize = 20) {
    return api.get('/files', { params: { page, pageSize } });
  },
  getFile(fileId) {
    return api.get(`/files/${fileId}`);
  },
  downloadFile(fileId) {
    return api.get(`/files/${fileId}/download`, { responseType: 'blob' });
  },
  deleteFile(fileId) {
    return api.delete(`/files/${fileId}`);
  },
  searchFiles(keyword, page = 1, pageSize = 20) {
    return api.get('/files/search', { params: { keyword, page, pageSize } });
  },
  getShareLink(fileId) {
    return api.get(`/files/${fileId}/share-link`);
  },
  getDownloadLogs(fileId) {
    return api.get(`/files/${fileId}/logs`);
  },

  // Users (admin)
  getUsers() {
    return api.get('/users');
  },
  createUser(username, password, role) {
    return api.post('/users', { username, password, role });
  },
  deleteUser(userId) {
    return api.delete(`/users/${userId}`);
  },
  changePassword(currentPassword, newPassword) {
    return api.put('/users/change-password', { currentPassword, newPassword });
  },
  resetPassword(userId, newPassword) {
    return api.put(`/users/${userId}/reset-password`, { newPassword });
  }
};
