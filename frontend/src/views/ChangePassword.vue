<template>
  <div class="change-password-container">
    <el-card class="change-password-card">
      <template #header>
        <h2>{{ t('changePassword.title') }}</h2>
      </template>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item :label="t('changePassword.currentPassword')" prop="currentPassword">
          <el-input v-model="form.currentPassword" type="password" :placeholder="t('changePassword.enterCurrentPassword')" />
        </el-form-item>
        <el-form-item :label="t('changePassword.newPassword')" prop="newPassword">
          <el-input v-model="form.newPassword" type="password" :placeholder="t('changePassword.enterNewPassword')" />
        </el-form-item>
        <el-form-item :label="t('changePassword.confirmPassword')" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" :placeholder="t('changePassword.enterConfirmPassword')" @keyup.enter="handleSubmit" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="loading">
            {{ t('changePassword.submit') }}
          </el-button>
          <el-button @click="handleCancel">
            {{ t('changePassword.cancel') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import api from '../api';

const { t } = useI18n();
const router = useRouter();

const form = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const formRef = ref(null);
const loading = ref(false);

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.value.newPassword) {
    callback(new Error(t('changePassword.passwordsNotMatch')));
  } else {
    callback();
  }
};

const rules = computed(() => ({
  currentPassword: [
    { required: true, message: t('changePassword.currentPasswordRequired'), trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: t('changePassword.newPasswordRequired'), trigger: 'blur' },
    { min: 6, message: t('changePassword.passwordMinLength'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: t('changePassword.confirmPasswordRequired'), trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}));

const handleSubmit = async () => {
  try {
    await formRef.value.validate();
    loading.value = true;

    await api.changePassword(form.value.currentPassword, form.value.newPassword);

    ElMessage.success(t('changePassword.changeSuccess'));
    router.push('/');
  } catch (err) {
    ElMessage.error(err.response?.data?.error || t('changePassword.changeFailed'));
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  router.back();
};
</script>

<style scoped>
.change-password-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 60px);
  padding: 20px;
}

.change-password-card {
  width: 500px;
}
</style>
