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
  /**
   * 用户登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<import('axios').AxiosResponse>} 包含 token 和用户信息的响应
   */
  login(username, password) {
    return api.post('/auth/login', { username, password });
  },
  /**
   * 用户登出，使当前令牌失效
   * @returns {Promise<import('axios').AxiosResponse>} 登出结果
   */
  logout() {
    return api.post('/auth/logout');
  },
  /**
   * 注册新用户
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @param {string} role - 用户角色（'user' 或 'admin'）
   * @returns {Promise<import('axios').AxiosResponse>} 注册结果
   */
  register(username, password, role) {
    return api.post('/auth/register', { username, password, role });
  },
  /**
   * 获取当前登录用户信息
   * @returns {Promise<import('axios').AxiosResponse>} 当前用户信息
   */
  getMe() {
    return api.get('/auth/me');
  },

  /**
   * 上传文件
   * @param {File} file - 要上传的文件对象
   * @param {Function} onProgress - 上传进度回调函数
   * @returns {Promise<import('axios').AxiosResponse>} 上传结果，包含文件信息和分享链接
   */
  uploadFile(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    });
  },
  /**
   * 获取文件列表（分页）
   * @param {number} [page=1] - 页码
   * @param {number} [pageSize=20] - 每页记录数
   * @returns {Promise<import('axios').AxiosResponse>} 分页文件列表
   */
  getFiles(page = 1, pageSize = 20) {
    return api.get('/files', { params: { page, pageSize } });
  },
  /**
   * 获取文件详情
   * @param {string} fileId - 文件 UUID
   * @returns {Promise<import('axios').AxiosResponse>} 文件详情
   */
  getFile(fileId) {
    return api.get(`/files/${fileId}`);
  },
  /**
   * 下载文件（以 Blob 形式返回）
   * @param {string} fileId - 文件 UUID
   * @returns {Promise<import('axios').AxiosResponse>} 文件二进制数据
   */
  downloadFile(fileId) {
    return api.get(`/files/${fileId}/download`, { responseType: 'blob' });
  },
  /**
   * 删除文件
   * @param {string} fileId - 文件 UUID
   * @returns {Promise<import('axios').AxiosResponse>} 删除结果
   */
  deleteFile(fileId) {
    return api.delete(`/files/${fileId}`);
  },
  /**
   * 按关键字搜索文件
   * @param {string} keyword - 搜索关键字
   * @param {number} [page=1] - 页码
   * @param {number} [pageSize=20] - 每页记录数
   * @returns {Promise<import('axios').AxiosResponse>} 搜索结果的分页列表
   */
  searchFiles(keyword, page = 1, pageSize = 20) {
    return api.get('/files/search', { params: { keyword, page, pageSize } });
  },
  /**
   * 获取文件的公开分享链接
   * @param {string} fileId - 文件 UUID
   * @returns {Promise<import('axios').AxiosResponse>} 包含 shareLink 的响应
   */
  getShareLink(fileId) {
    return api.get(`/files/${fileId}/share-link`);
  },
  /**
   * 获取文件的下载日志
   * @param {string} fileId - 文件 UUID
   * @returns {Promise<import('axios').AxiosResponse>} 下载日志数组
   */
  getDownloadLogs(fileId) {
    return api.get(`/files/${fileId}/logs`);
  },

  /**
   * 获取所有用户列表（管理员接口）
   * @returns {Promise<import('axios').AxiosResponse>} 用户数组
   */
  getUsers() {
    return api.get('/users');
  },
  /**
   * 创建新用户（管理员接口）
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @param {string} role - 用户角色
   * @returns {Promise<import('axios').AxiosResponse>} 创建结果
   */
  createUser(username, password, role) {
    return api.post('/users', { username, password, role });
  },
  /**
   * 删除用户（管理员接口）
   * @param {number} userId - 用户 ID
   * @returns {Promise<import('axios').AxiosResponse>} 删除结果
   */
  deleteUser(userId) {
    return api.delete(`/users/${userId}`);
  },
  /**
   * 修改当前用户密码
   * @param {string} currentPassword - 当前密码
   * @param {string} newPassword - 新密码
   * @returns {Promise<import('axios').AxiosResponse>} 修改结果
   */
  changePassword(currentPassword, newPassword) {
    return api.put('/users/change-password', { currentPassword, newPassword });
  },
  /**
   * 重置指定用户的密码（管理员接口）
   * @param {number} userId - 用户 ID
   * @param {string} newPassword - 新密码
   * @returns {Promise<import('axios').AxiosResponse>} 重置结果
   */
  resetPassword(userId, newPassword) {
    return api.put(`/users/${userId}/reset-password`, { newPassword });
  }
};
