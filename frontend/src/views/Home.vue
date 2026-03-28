<template>
  <div class="home-container">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" :size="40" color="#409eff"><Document /></el-icon>
            <div class="stat-info">
              <h2>{{ stats.totalFiles }}</h2>
              <p>{{ t('home.totalFiles') }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" :size="40" color="#67c23a"><Download /></el-icon>
            <div class="stat-info">
              <h2>{{ stats.totalDownloads }}</h2>
              <p>{{ t('home.totalDownloads') }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" :size="40" color="#e6a23c"><FolderOpened /></el-icon>
            <div class="stat-info">
              <h2>{{ formatFileSize(stats.totalSize) }}</h2>
              <p>{{ t('home.totalStorage') }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px">
      <template #header>
        <h3>{{ t('home.welcomeTitle') }}</h3>
      </template>
      <div class="welcome-content">
        <p>{{ t('home.welcomeText') }}</p>
        <el-divider />
        <h4>{{ t('home.quickActions') }}</h4>
        <div class="quick-actions">
          <el-button type="primary" @click="$router.push('/upload')">{{ t('home.uploadFile') }}</el-button>
          <el-button @click="$router.push('/files')">{{ t('home.viewFiles') }}</el-button>
          <el-button v-if="authStore.isAdmin" @click="$router.push('/users')">{{ t('home.manageUsers') }}</el-button>
        </div>
      </div>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header>
        <h3>{{ t('home.recentFiles') }}</h3>
      </template>
      <el-table :data="recentFiles" v-loading="loading">
        <el-table-column prop="original_name" :label="t('home.fileName')" />
        <el-table-column prop="uploader_name" :label="t('home.uploader')" width="120" />
        <el-table-column prop="upload_time" :label="t('home.uploadTime')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.upload_time) }}
          </template>
        </el-table-column>
        <el-table-column :label="t('home.actions')" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push('/files')">{{ t('home.viewAll') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
/**
 * 首页仪表盘
 * 展示文件总数、下载总次数、总存储空间等统计信息，
 * 提供上传文件、查看文件、管理用户等快捷操作入口，
 * 并展示最近上传的文件列表。
 */
import { ref, onMounted } from 'vue';
import { Document, Download, FolderOpened } from '@element-plus/icons-vue';
import { useAuthStore } from '../store/auth';
import { useI18n } from 'vue-i18n';
import api from '../api';

const { t } = useI18n();
const authStore = useAuthStore();
const loading = ref(false);
const recentFiles = ref([]);
const stats = ref({
  totalFiles: 0,
  totalDownloads: 0,
  totalSize: 0
});

const loadData = async () => {
  try {
    loading.value = true;
    const response = await api.getFiles();
    const files = response.data;

    recentFiles.value = files.slice(0, 5);
    stats.value.totalFiles = files.length;
    stats.value.totalDownloads = files.reduce((sum, file) => sum + file.download_count, 0);
    stats.value.totalSize = files.reduce((sum, file) => sum + file.file_size, 0);
  } catch (error) {
    console.error('Failed to load data:', error);
  } finally {
    loading.value = false;
  }
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.home-container {
  max-width: 1400px;
  margin: 0 auto;
}

.stat-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.stat-info h2 {
  margin: 0;
  font-size: 32px;
  color: #303133;
}

.stat-info p {
  margin: 5px 0 0 0;
  color: #909399;
}

.welcome-content {
  padding: 10px 0;
}

.quick-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}
</style>
