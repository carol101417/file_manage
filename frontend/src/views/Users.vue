<template>
  <div class="users-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <h3>{{ t('users.title') }}</h3>
          <el-button type="primary" @click="dialogVisible = true">{{ t('users.createUser') }}</el-button>
        </div>
      </template>

      <el-table :data="users" v-loading="loading" style="width: 100%">
        <el-table-column prop="id" :label="t('users.id')" width="80" />
        <el-table-column prop="username" :label="t('users.username')" min-width="150" />
        <el-table-column prop="role" :label="t('users.role')" width="120">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'primary'">
              {{ row.role }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" :label="t('users.createdAt')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column :label="t('users.actions')" width="200">
          <template #default="{ row }">
            <el-button
              size="small"
              type="warning"
              @click="handleResetPassword(row)"
            >
              {{ t('users.resetPassword') }}
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="handleDelete(row)"
              :disabled="row.id === authStore.user.id"
            >
              {{ t('users.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="t('users.createUserTitle')" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item :label="t('users.username')" prop="username">
          <el-input v-model="form.username" :placeholder="t('users.enterUsername')" />
        </el-form-item>
        <el-form-item :label="t('users.password')" prop="password">
          <el-input v-model="form.password" type="password" :placeholder="t('users.enterPassword')" />
        </el-form-item>
        <el-form-item :label="t('users.role')" prop="role">
          <el-select v-model="form.role" :placeholder="t('users.selectRole')" style="width: 100%">
            <el-option :label="t('users.roleUser')" value="user" />
            <el-option :label="t('users.roleAdmin')" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('users.cancel') }}</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">{{ t('users.create') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resetPasswordDialogVisible" :title="t('users.resetPasswordTitle')" width="500px">
      <el-form :model="resetPasswordForm" :rules="resetPasswordRules" ref="resetPasswordFormRef" label-width="120px">
        <el-form-item :label="t('users.newPassword')" prop="newPassword">
          <el-input v-model="resetPasswordForm.newPassword" type="password" :placeholder="t('users.enterNewPassword')" />
        </el-form-item>
        <el-form-item :label="t('users.confirmPassword')" prop="confirmPassword">
          <el-input v-model="resetPasswordForm.confirmPassword" type="password" :placeholder="t('users.confirmNewPassword')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPasswordDialogVisible = false">{{ t('users.cancel') }}</el-button>
        <el-button type="primary" @click="handleResetPasswordConfirm" :loading="resetting">{{ t('users.reset') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '../store/auth';
import { useI18n } from 'vue-i18n';
import api from '../api';

const { t } = useI18n();
const authStore = useAuthStore();
const users = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const creating = ref(false);
const formRef = ref(null);

const resetPasswordDialogVisible = ref(false);
const resetting = ref(false);
const resetPasswordFormRef = ref(null);
const selectedUser = ref(null);

const form = ref({
  username: '',
  password: '',
  role: 'user'
});

const resetPasswordForm = ref({
  newPassword: '',
  confirmPassword: ''
});

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== resetPasswordForm.value.newPassword) {
    callback(new Error(t('users.passwordsNotMatch')));
  } else {
    callback();
  }
};

const rules = computed(() => ({
  username: [
    { required: true, message: t('users.usernameRequired'), trigger: 'blur' },
    { min: 3, message: t('users.usernameMinLength'), trigger: 'blur' }
  ],
  password: [
    { required: true, message: t('users.passwordRequired'), trigger: 'blur' },
    { min: 6, message: t('users.passwordMinLength'), trigger: 'blur' }
  ],
  role: [{ required: true, message: t('users.roleRequired'), trigger: 'change' }]
}));

const resetPasswordRules = computed(() => ({
  newPassword: [
    { required: true, message: t('users.newPasswordRequired'), trigger: 'blur' },
    { min: 6, message: t('users.passwordMinLength'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: t('users.confirmPasswordRequired'), trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}));

const loadUsers = async () => {
  try {
    loading.value = true;
    const response = await api.getUsers();
    users.value = response.data;
  } catch (error) {
    ElMessage.error(error.response?.data?.error || t('users.loadFailed'));
  } finally {
    loading.value = false;
  }
};

const handleCreate = async () => {
  try {
    await formRef.value.validate();
    creating.value = true;

    await api.createUser(form.value.username, form.value.password, form.value.role);
    ElMessage.success(t('users.createSuccess'));
    dialogVisible.value = false;
    form.value = { username: '', password: '', role: 'user' };
    loadUsers();
  } catch (error) {
    ElMessage.error(error.response?.data?.error || t('users.createFailed'));
  } finally {
    creating.value = false;
  }
};

const handleDelete = async (user) => {
  try {
    await ElMessageBox.confirm(
      t('users.confirmDeleteUser', { name: user.username }),
      t('users.confirmDelete'),
      {
        confirmButtonText: t('users.delete'),
        cancelButtonText: t('users.cancel'),
        type: 'warning'
      }
    );

    await api.deleteUser(user.id);
    ElMessage.success(t('users.deleteSuccess'));
    loadUsers();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || t('users.deleteFailed'));
    }
  }
};

const handleResetPassword = (user) => {
  selectedUser.value = user;
  resetPasswordForm.value = { newPassword: '', confirmPassword: '' };
  resetPasswordDialogVisible.value = true;
};

const handleResetPasswordConfirm = async () => {
  try {
    await resetPasswordFormRef.value.validate();
    resetting.value = true;

    await api.resetPassword(selectedUser.value.id, resetPasswordForm.value.newPassword);
    ElMessage.success(t('users.resetSuccess'));
    resetPasswordDialogVisible.value = false;
  } catch (error) {
    ElMessage.error(error.response?.data?.error || t('users.resetFailed'));
  } finally {
    resetting.value = false;
  }
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};

onMounted(() => {
  loadUsers();
});
</script>

<style scoped>
.users-container {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
