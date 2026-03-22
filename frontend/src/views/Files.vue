<template>
  <div class="files-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <h3>{{ t('files.title') }}</h3>
          <el-input
            v-model="searchKeyword"
            :placeholder="t('files.searchPlaceholder')"
            style="width: 300px"
            clearable
            @clear="loadFiles"
          >
            <template #append>
              <el-button @click="() => { currentPage = 1; handleSearch(); }" :icon="Search">{{ t('files.search') }}</el-button>
            </template>
          </el-input>
        </div>
      </template>

      <el-table :data="files" v-loading="loading" style="width: 100%">
        <el-table-column prop="original_name" :label="t('files.fileName')" min-width="200" />
        <el-table-column prop="file_size" :label="t('files.size')" width="120">
          <template #default="{ row }">
            {{ formatFileSize(row.file_size) }}
          </template>
        </el-table-column>
        <el-table-column prop="uploader_name" :label="t('files.uploader')" width="120" />
        <el-table-column prop="upload_time" :label="t('files.uploadTime')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.upload_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="download_count" :label="t('files.downloads')" width="100" align="center" />
        <el-table-column :label="t('files.actions')" width="300" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleDownload(row)">{{ t('files.download') }}</el-button>
            <el-button size="small" @click="handleGetLink(row)">{{ t('files.getLink') }}</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">{{ t('files.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="totalFiles"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="linkDialogVisible" :title="t('files.shareLinkTitle')" width="600px">
      <el-input v-model="currentShareLink" readonly>
        <template #append>
          <el-button @click="copyLink">{{ t('files.copy') }}</el-button>
        </template>
      </el-input>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import api from '../api';

const { t } = useI18n();
const files = ref([]);
const loading = ref(false);
const searchKeyword = ref('');
const linkDialogVisible = ref(false);
const currentShareLink = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const totalFiles = ref(0);

const loadFiles = async () => {
  try {
    loading.value = true;
    const response = await api.getFiles(currentPage.value, pageSize.value);
    files.value = response.data.files;
    totalFiles.value = response.data.total;
  } catch (error) {
    ElMessage.error(error.response?.data?.error || t('files.loadFailed'));
  } finally {
    loading.value = false;
  }
};

const handleSearch = async () => {
  if (!searchKeyword.value.trim()) {
    loadFiles();
    return;
  }

  try {
    loading.value = true;
    const response = await api.searchFiles(searchKeyword.value, currentPage.value, pageSize.value);
    files.value = response.data.files;
    totalFiles.value = response.data.total;
  } catch (error) {
    ElMessage.error(error.response?.data?.error || t('files.searchFailed'));
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (page) => {
  currentPage.value = page;
  if (searchKeyword.value.trim()) {
    handleSearch();
  } else {
    loadFiles();
  }
};

const handlePageSizeChange = (size) => {
  pageSize.value = size;
  currentPage.value = 1;
  if (searchKeyword.value.trim()) {
    handleSearch();
  } else {
    loadFiles();
  }
};

const handleDownload = async (file) => {
  try {
    const response = await api.downloadFile(file.file_id);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const contentDisposition = response.headers?.['content-disposition'];
    const filenameFromHeader = getFilenameFromContentDisposition(contentDisposition);
    link.setAttribute('download', filenameFromHeader || file.original_name || 'download');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ElMessage.success(t('files.downloadStarted'));
    loadFiles(); // Refresh to update download count
  } catch (error) {
    ElMessage.error(error.response?.data?.error || t('files.downloadFailed'));
  }
};

const getFilenameFromContentDisposition = (header) => {
  if (!header || typeof header !== 'string') return '';

  // RFC 5987: filename*=UTF-8''%E4%B8%AD%E6%96%87.txt
  const matchStar = header.match(/filename\*\s*=\s*([^']*)''([^;]+)/i);
  if (matchStar) {
    const charset = (matchStar[1] || '').toLowerCase();
    const value = matchStar[2] || '';
    try {
      const decoded = decodeURIComponent(value);
      return charset === 'utf-8' ? decoded : decoded;
    } catch {
      // ignore
    }
  }

  // Basic: filename="example.txt" or filename=example.txt
  const match = header.match(/filename\s*=\s*("?)([^";]+)\1/i);
  if (match) return match[2] || '';

  return '';
};

const handleGetLink = async (file) => {
  try {
    const response = await api.getShareLink(file.file_id);
    currentShareLink.value = window.location.origin + response.data.shareLink;
    linkDialogVisible.value = true;
  } catch (error) {
    ElMessage.error(error.response?.data?.error || t('files.getLinkFailed'));
  }
};

const handleDelete = async (file) => {
  try {
    await ElMessageBox.confirm(
      t('files.confirmDeleteFile', { name: file.original_name }),
      t('files.confirmDelete'),
      {
        confirmButtonText: t('files.delete'),
        cancelButtonText: t('files.cancel'),
        type: 'warning'
      }
    );

    await api.deleteFile(file.file_id);
    ElMessage.success(t('files.deleteSuccess'));
    loadFiles();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || t('files.deleteFailed'));
    }
  }
};

const copyLink = () => {
  navigator.clipboard.writeText(currentShareLink.value);
  ElMessage.success(t('files.linkCopied'));
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
  loadFiles();
});
</script>

<style scoped>
.files-container {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
