<template>
  <div class="upload-container">
    <el-card>
      <template #header>
        <h3>{{ t('upload.title') }}</h3>
      </template>

      <el-upload
        ref="uploadRef"
        class="upload-demo"
        drag
        :auto-upload="false"
        :on-change="handleFileChange"
        :limit="1"
        :file-list="fileList"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          {{ t('upload.dropText') }}<em>{{ t('upload.clickUpload') }}</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            {{ t('upload.maxSize') }}
          </div>
        </template>
      </el-upload>

      <div v-if="uploadProgress > 0" class="progress-container">
        <el-progress :percentage="uploadProgress" :status="uploadStatus" />
      </div>

      <div class="button-group">
        <el-button type="primary" @click="handleUpload" :loading="uploading" :disabled="!fileList.length">
          {{ t('upload.uploadButton') }}
        </el-button>
        <el-button @click="handleClear">{{ t('upload.clearButton') }}</el-button>
      </div>

      <el-alert v-if="shareLink" :title="t('upload.successTitle')" type="success" style="margin-top: 20px">
        <div>
          <p><strong>{{ t('upload.shareLink') }}</strong></p>
          <el-input v-model="shareLink" readonly>
            <template #append>
              <el-button @click="copyLink">{{ t('upload.copy') }}</el-button>
            </template>
          </el-input>
        </div>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup>
/**
 * 文件上传页面
 * 提供拖拽或点击上传功能，支持文件大小校验（最大 100MB）、
 * 上传进度显示，上传成功后展示公开分享链接并支持一键复制。
 */
import { ref } from 'vue';
import { UploadFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import api from '../api';

const { t } = useI18n();
const uploadRef = ref(null);
const fileList = ref([]);
const uploading = ref(false);
const uploadProgress = ref(0);
const uploadStatus = ref('');
const shareLink = ref('');

const handleFileChange = (file, files) => {
  // Check file size (100MB = 104857600 bytes)
  if (file.size > 104857600) {
    ElMessage.error(t('upload.fileTooLarge'));
    return false;
  }
  fileList.value = files;
  shareLink.value = '';
  uploadProgress.value = 0;
};

const handleUpload = async () => {
  if (!fileList.value.length) {
    ElMessage.warning(t('upload.selectFile'));
    return;
  }

  try {
    uploading.value = true;
    uploadProgress.value = 0;
    uploadStatus.value = '';

    const file = fileList.value[0].raw;
    const response = await api.uploadFile(file, (progressEvent) => {
      uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
    });

    uploadStatus.value = 'success';
    shareLink.value = window.location.origin + response.data.file.shareLink;
    ElMessage.success(t('upload.uploadSuccess'));
  } catch (error) {
    uploadStatus.value = 'exception';
    ElMessage.error(error.response?.data?.error || t('upload.uploadFailed'));
  } finally {
    uploading.value = false;
  }
};

const handleClear = () => {
  fileList.value = [];
  uploadProgress.value = 0;
  shareLink.value = '';
  uploadStatus.value = '';
};

const copyLink = () => {
  navigator.clipboard.writeText(shareLink.value);
  ElMessage.success(t('upload.linkCopied'));
};
</script>

<style scoped>
.upload-container {
  max-width: 800px;
  margin: 0 auto;
}

.upload-demo {
  margin-bottom: 20px;
}

.progress-container {
  margin: 20px 0;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.el-icon--upload {
  font-size: 67px;
  color: #409eff;
  margin-bottom: 16px;
}
</style>
