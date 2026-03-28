<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <h2>{{ t('login.title') }}</h2>
      </template>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item :label="t('login.username')" prop="username">
          <el-input v-model="form.username" :placeholder="t('login.enterUsername')" />
        </el-form-item>
        <el-form-item :label="t('login.password')" prop="password">
          <el-input v-model="form.password" type="password" :placeholder="t('login.enterPassword')" @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleLogin" :loading="loading" style="width: 100%">
            {{ t('login.loginButton') }}
          </el-button>
        </el-form-item>
      </el-form>
      <el-alert v-if="error" :title="error" type="error" :closable="false" style="margin-top: 10px" />
    </el-card>
  </div>
</template>

<script setup>
/**
 * 登录页面
 * 提供用户名和密码输入表单，通过认证 Store 调用登录接口，
 * 登录成功后跳转至首页，失败时显示错误提示。
 */
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const form = ref({
  username: '',
  password: ''
});

const formRef = ref(null);
const loading = ref(false);
const error = ref('');

const rules = computed(() => ({
  username: [{ required: true, message: t('login.usernameRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }]
}));

const handleLogin = async () => {
  try {
    await formRef.value.validate();
    loading.value = true;
    error.value = '';

    await authStore.login(form.value.username, form.value.password);
    ElMessage.success(t('login.loginSuccess'));
    router.push('/');
  } catch (err) {
    error.value = err.response?.data?.error || t('login.loginFailed');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 400px;
}
</style>
