<template>
  <el-config-provider>
    <div id="app">
      <el-container v-if="authStore.isAuthenticated && $route.path !== '/login'">
        <el-header>
          <div class="header-content">
            <h2>{{ $t('nav.title') }}</h2>
            <div class="header-right">
              <el-menu mode="horizontal" :default-active="$route.path" router>
                <el-menu-item index="/">{{ $t('nav.home') }}</el-menu-item>
                <el-menu-item index="/files">{{ $t('nav.files') }}</el-menu-item>
                <el-menu-item index="/upload">{{ $t('nav.upload') }}</el-menu-item>
                <el-menu-item v-if="authStore.isAdmin" index="/users">{{ $t('nav.users') }}</el-menu-item>
              </el-menu>
              <div class="user-info">
                <el-button
                  size="small"
                  @click="toggleLanguage"
                  class="lang-btn"
                >
                  {{ locale === 'zh' ? 'EN' : '中文' }}
                </el-button>
                <el-dropdown @command="handleCommand">
                  <span class="user-dropdown">
                    {{ authStore.user?.username }}
                    <el-icon class="el-icon--right"><arrow-down /></el-icon>
                  </span>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="change-password">{{ $t('nav.changePassword') }}</el-dropdown-item>
                      <el-dropdown-item command="logout" divided>{{ $t('nav.logout') }}</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </div>
        </el-header>
        <el-main>
          <router-view />
        </el-main>
      </el-container>
      <router-view v-else />
    </div>
  </el-config-provider>
</template>

<script setup>
import { useAuthStore } from './store/auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowDown } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const router = useRouter();
const { locale } = useI18n();

const toggleLanguage = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
  localStorage.setItem('language', locale.value);
};

const handleCommand = (command) => {
  if (command === 'logout') {
    handleLogout();
  } else if (command === 'change-password') {
    router.push('/change-password');
  }
};

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  height: 100vh;
}

.el-container {
  height: 100vh;
}

.el-header {
  background-color: #409eff;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: white;
}

.lang-btn {
  background-color: rgba(255, 255, 255, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
  color: white !important;
}

.lang-btn:hover {
  background-color: rgba(255, 255, 255, 0.3) !important;
}

.user-dropdown {
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.user-dropdown:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.el-main {
  background-color: #f5f5f5;
  padding: 20px;
}
</style>
