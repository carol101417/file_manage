import { defineStore } from 'pinia';
import api from '../api';

/**
 * 认证状态管理 Store
 * 管理用户登录状态、令牌和用户信息，数据同步持久化到 localStorage
 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token') || null
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'admin'
  },

  actions: {
    /**
     * 执行用户登录，将令牌和用户信息存储到 state 及 localStorage
     * @param {string} username - 用户名
     * @param {string} password - 密码
     */
    async login(username, password) {
      const response = await api.login(username, password);
      this.token = response.data.token;
      this.user = response.data.user;
      localStorage.setItem('token', this.token);
      localStorage.setItem('user', JSON.stringify(this.user));
    },

    /**
     * 执行用户登出，调用后端接口使令牌失效并清除本地状态
     */
    async logout() {
      try {
        await api.logout();
      } catch (e) {
        // Ignore logout API errors
      }
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },

    /**
     * 从后端获取最新的用户信息并更新本地状态
     */
    async fetchUser() {
      const response = await api.getMe();
      this.user = response.data;
      localStorage.setItem('user', JSON.stringify(this.user));
    }
  }
});
