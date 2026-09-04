<template>
  <PageShell
    title="编辑资料"
    :back-fallback="ROUTES.mine"
  >
    <template #before>
      <view
        v-if="avatarSheetOpen"
        class="avatar-mask"
        @tap="closeAvatarSheet"
      >
        <view class="avatar-mask-dim" />
        <view
          class="avatar-sheet"
          @tap.stop
        >
          <view class="sheet-title">
            更换头像
          </view>
          <view class="sheet-copy">
            {{ avatarSheetCopy }}
          </view>
          <view
            v-if="avatarBusy"
            class="sheet-copy"
          >
            正在上传头像…
          </view>
          <view
            class="sheet-item pressable"
            @tap="pickFromAlbum"
          >
            从相册选择
          </view>
          <view
            class="sheet-item pressable"
            @tap="pickFromCamera"
          >
            拍照
          </view>
          <!-- 微信头像必须用原生 button open-type="chooseAvatar"。 -->
          <!--  #ifdef  MP-WEIXIN -->
          <view
            v-if="canUseWechatAuth"
            class="sheet-item pressable"
            @tap="pickFromChat"
          >
            从聊天记录选择
          </view>
          <button
            v-if="canUseWechatAuth"
            class="sheet-item sheet-button pressable"
            open-type="chooseAvatar"
            :disabled="saving || avatarBusy"
            @chooseavatar="onChooseWechatAvatar"
          >
            使用微信头像
          </button>
          <!--  #endif -->
          <view
            class="sheet-item sheet-cancel pressable"
            @tap="closeAvatarSheet"
          >
            取消
          </view>
        </view>
      </view>
    </template>

    <view
      v-if="loading"
      class="state-card"
    >
      正在读取资料…
    </view>
    <view
      v-else-if="loadError"
      class="state-card"
    >
      <view>{{ loadError }}</view>
      <BaseButton
        class="state-action"
        block
        @click="getInfo"
      >
        重试
      </BaseButton>
    </view>
    <view
      v-else
      class="profile-form"
    >
      <view
        v-if="saveError"
        class="form-error"
      >
        {{ saveError }}
      </view>
      <view class="edit-hero">
        <view
          class="avatar-hit pressable"
          @tap="openAvatarSheet"
          @click="openAvatarSheet"
        >
          <image
            class="hero-avatar"
            :src="avatarSrc"
            mode="aspectFill"
          />
        </view>
        <view class="edit-hero-hint">
          {{ avatarHint }}
        </view>
      </view>

      <SectionBlock title="公开档案">
        <view
          class="row pressable"
          @tap="goUserUsername"
        >
          <view class="row-label">
            用户名
          </view>
          <view class="row-value">
            {{ user.username || '未填写' }}
          </view>
        </view>
        <view
          class="row pressable"
          @tap="goUserNickname"
        >
          <view class="row-label">
            昵称
          </view>
          <view class="row-value">
            {{ user.nickname || '未填写' }}
          </view>
        </view>
      </SectionBlock>

      <SectionBlock title="账号与安全（仅自己可见）">
        <view
          class="row pressable"
          @tap="goUserEmail"
        >
          <view class="row-label">
            邮箱
          </view>
          <view class="row-value">
            {{ user.email || '未填写' }}
          </view>
        </view>
        <view
          class="row pressable"
          @tap="goUserPhone"
        >
          <view class="row-label">
            手机
          </view>
          <view class="row-value">
            {{ user.telephone || '未填写' }}
          </view>
        </view>
        <view
          class="row pressable"
          @tap="openBirthdayPicker"
        >
          <view class="row-label">
            生日
          </view>
          <view class="row-value">
            {{ date }}
          </view>
        </view>
      </SectionBlock>

      <SectionBlock title="装罐默认">
        <view
          class="row pressable"
          @tap="openDialectPicker"
        >
          <view class="row-label">
            发音默认地点
          </view>
          <view class="row-value">
            {{ selectedDialectLabel }}
          </view>
        </view>
      </SectionBlock>

      <t-date-time-picker
        v-if="birthdayPickerOpen"
        :visible="birthdayPickerOpen"
        title="生日"
        mode="date"
        format="YYYY-MM-DD"
        start="1960-09-01"
        end="2020-09-01"
        cancel-btn="取消"
        confirm-btn="确定"
        :value="birthdayPickerValue"
        @confirm="onBirthdayConfirm"
        @cancel="closeBirthdayPicker"
        @close="closeBirthdayPicker"
      />
      <DialectSelector
        v-model:visible="dialectPickerOpen"
        :value="selectedDialect?.id || ''"
        :dialects="dialectOptions"
        :default-dialect="user.primary_dialect"
        :owner-scope="user.id || 'guest'"
        title="发音默认地点"
        @change="onDialectChange"
      />
    </view>
  </PageShell>
</template>

<script>
import TDateTimePicker from '@tdesign/uniapp/date-time-picker/date-time-picker.vue';
import BaseButton from '@/components/BaseButton.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import { notify, notifySuccess } from '@/services/feedback';
import { uploadFile } from '@/services/file';
import { listAllDialects } from '@/services/guantou';
import {
  goLogin,
  goUserEmail,
  goUserNickname,
  goUserPhone,
  goUserUsername,
  ROUTES,
} from '@/services/navigation';
import { resolveSessionUserId } from '@/services/session';
import canUseWechatMiniProgramAuth from '@/services/platform';
import { changeUserInfo, getUserInfo } from '@/services/user';
import { dialectBreadcrumb } from '@/utils/dialectTree';

const app = getApp();
// 微信头像只能写在原生 button[open-type=chooseAvatar] 上，因此保留小程序条件编译。
// H5 没有这项开放能力，只保留相册/拍照。微信昵称改在修改昵称页授权填入。
const BIRTHDAY_START = '1960-09-01';
const BIRTHDAY_END = '2020-09-01';
const BIRTHDAY_FALLBACK = '1990-01-01';

function fieldErrorMessage(error, field) {
  const item = error?.data?.[field] || error?.data?.user?.[field];
  if (typeof item === 'string') return item;
  if (item?.message) return item.message;
  return '';
}

function pickerEventValue(event) {
  if (event == null) return undefined;
  if (Object.prototype.hasOwnProperty.call(event, 'detail')) {
    return event.detail?.value ?? event.detail;
  }
  return event.value;
}

function isDateValue(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export default {
  name: 'EditProfile',
  components: {
    BaseButton,
    DialectSelector,
    PageShell,
    SectionBlock,
    TDateTimePicker,
  },
  data() {
    return {
      ROUTES,
      user: {},
      date: '未知',
      dialectIndex: -1,
      dialectOptions: [],
      loading: true,
      loadError: '',
      saveError: '',
      saving: false,
      avatarSheetOpen: false,
      avatarBusy: false,
      pickingAvatar: false,
      avatarPreview: '',
      birthdayPickerOpen: false,
      dialectPickerOpen: false,
      canUseWechatAuth: canUseWechatMiniProgramAuth(),
    };
  },
  computed: {
    selectedDialect() {
      return this.dialectOptions[this.dialectIndex] || null;
    },
    selectedDialectLabel() {
      return this.selectedDialect
        ? dialectBreadcrumb(this.selectedDialect, this.dialectOptions)
        : '未填写方言点';
    },
    birthdayPickerValue() {
      return isDateValue(this.date) ? this.date : BIRTHDAY_FALLBACK;
    },
    avatarSrc() {
      return this.avatarPreview || this.user.avatar;
    },
    avatarHint() {
      if (this.canUseWechatAuth) {
        return '点击头像更换。可用相册、拍照、聊天图片，或授权微信头像。';
      }
      return '点击头像更换，可用相册或相机选取。';
    },
    avatarSheetCopy() {
      if (this.canUseWechatAuth) {
        return '选好后立刻上传并保存。使用微信头像需要点选授权。';
      }
      return '选好照片后立刻上传并保存。';
    },
  },
  onShow() {
    if (!resolveSessionUserId()) {
      goLogin({}, { reset: true });
      return;
    }
    if (this.pickingAvatar || this.avatarBusy || this.saving) return;
    this.getInfo();
  },
  methods: {
    goUserNickname,
    goUserEmail,
    goUserPhone,
    goUserUsername,
    openAvatarSheet() {
      if (this.saving || this.avatarBusy) return;
      this.avatarSheetOpen = true;
    },
    closeAvatarSheet() {
      if (this.saving || this.avatarBusy) return;
      this.avatarSheetOpen = false;
    },
    openBirthdayPicker() {
      if (this.saving || this.avatarBusy) return;
      this.birthdayPickerOpen = true;
    },
    closeBirthdayPicker() {
      this.birthdayPickerOpen = false;
    },
    openDialectPicker() {
      if (this.saving || this.avatarBusy) return;
      if (!this.dialectOptions.length) {
        notify({ title: '暂时没有方言点可选' });
        return;
      }
      this.dialectPickerOpen = true;
    },
    closeDialectPicker() {
      this.dialectPickerOpen = false;
    },
    isUserCancel(error) {
      const message = error?.errMsg || error?.message || '';
      return /cancel/i.test(message);
    },
    chooseImagePath(sourceType) {
      return new Promise((resolve, reject) => {
        uni.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType,
          success: (res) => {
            const path = res.tempFilePaths?.[0]
              || res.tempFiles?.[0]?.path
              || res.tempFiles?.[0]?.tempFilePath
              || '';
            if (!path) {
              reject(new Error('未选择图片'));
              return;
            }
            resolve(path);
          },
          fail: reject,
        });
      });
    },
    async saveAvatarFromPath(path, { closeSheet = true } = {}) {
      if (!path || this.saving || this.avatarBusy) return;
      this.avatarBusy = true;
      this.saveError = '';
      this.avatarPreview = path;
      try {
        const uploaded = await uploadFile(path);
        const url = uploaded?.url;
        if (!url) {
          throw new Error('头像上传失败，请检查网络后重试');
        }
        await this.persistUser({ ...this.user, avatar: url });
        this.avatarPreview = '';
        if (closeSheet) this.avatarSheetOpen = false;
      } catch (error) {
        this.avatarPreview = '';
        this.saveError = fieldErrorMessage(error, 'avatar')
          || error?.message
          || '头像上传失败，请检查网络后重试';
        notify({ title: this.saveError });
      } finally {
        this.avatarBusy = false;
      }
    },
    async withAvatarPicker(run, failMessage) {
      this.pickingAvatar = true;
      try {
        await run();
      } catch (error) {
        if (this.isUserCancel(error)) return;
        this.saveError = failMessage;
        notify({ title: this.saveError });
      } finally {
        this.pickingAvatar = false;
      }
    },
    async pickFromAlbum() {
      await this.withAvatarPicker(async () => {
        const path = await this.chooseImagePath(['album']);
        await this.saveAvatarFromPath(path);
      }, '选择相册图片失败');
    },
    async pickFromCamera() {
      await this.withAvatarPicker(async () => {
        const path = await this.chooseImagePath(['camera']);
        await this.saveAvatarFromPath(path);
      }, '拍照失败');
    },
    async pickFromChat() {
      await this.withAvatarPicker(async () => {
        const path = await new Promise((resolve, reject) => {
          uni.chooseMessageFile({
            count: 1,
            type: 'image',
            success: (res) => {
              const file = res.tempFiles?.[0] || {};
              const nextPath = file.path || file.tempFilePath || '';
              if (!nextPath) {
                reject(new Error('未选择图片'));
                return;
              }
              resolve(nextPath);
            },
            fail: reject,
          });
        });
        await this.saveAvatarFromPath(path);
      }, '选择聊天记录图片失败');
    },
    async onChooseWechatAvatar(event) {
      const path = event?.detail?.avatarUrl || '';
      await this.saveAvatarFromPath(path);
    },
    async getInfo() {
      this.loading = true;
      this.loadError = '';
      try {
        this.dialectOptions = await listAllDialects();
        const userInfo = await getUserInfo(resolveSessionUserId(), true);
        this.user = { ...userInfo.user };
        this.date = userInfo.user.birthday || '未知';
        this.dialectIndex = userInfo.user.primary_dialect
          ? this.dialectOptions.findIndex(
            (dialect) => dialect.id === userInfo.user.primary_dialect.id,
          )
          : -1;
      } catch (error) {
        this.loadError = error?.message || '资料加载失败，请检查网络后重试';
      } finally {
        this.loading = false;
      }
    },
    async persistUser(nextUser) {
      if (this.saving) return;
      this.saving = true;
      this.saveError = '';
      try {
        const res = await changeUserInfo(resolveSessionUserId(), nextUser);
        this.user = { ...(res.user || nextUser) };
        app.globalData.userInfo = this.user;
        notifySuccess('修改成功');
      } catch (error) {
        this.saveError = fieldErrorMessage(error, 'primary_dialect')
          || fieldErrorMessage(error, 'birthday')
          || fieldErrorMessage(error, 'telephone')
          || fieldErrorMessage(error, 'avatar')
          || fieldErrorMessage(error, 'nickname')
          || error?.message
          || '保存失败，请检查网络后重试';
        notify({ title: this.saveError });
      } finally {
        this.saving = false;
      }
    },
    async onBirthdayConfirm(event) {
      const value = pickerEventValue(event);
      this.closeBirthdayPicker();
      if (!isDateValue(value) || value < BIRTHDAY_START || value > BIRTHDAY_END) return;
      if (value === this.date) return;
      this.date = value;
      await this.persistUser({ ...this.user, birthday: value });
    },
    async onDialectChange({ value }) {
      const dialectId = Number(value);
      const nextIndex = this.dialectOptions.findIndex((dialect) => dialect.id === dialectId);
      if (nextIndex < 0) return;
      if (nextIndex === this.dialectIndex) return;
      const dialect = this.dialectOptions[nextIndex];
      this.dialectIndex = nextIndex;
      await this.persistUser({ ...this.user, primary_dialect_id: dialect.id });
    },
  },
};
</script>

<style scoped>
.state-card {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--text-secondary-color);
}

.state-action {
  margin-top: var(--space-3);
}

.profile-form {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.form-error {
  margin-bottom: var(--space-3);
  color: var(--danger-color);
  font-size: var(--font-size-sm);
}

.edit-hero {
  margin-bottom: var(--space-4);
  text-align: center;
}

.edit-hero-hint {
  margin-top: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.hero-avatar {
  width: 168rpx;
  height: 168rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
}

.avatar-hit {
  display: inline-block;
}

.avatar-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.avatar-mask-dim {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: var(--text-color);
  opacity: 0.4;
}

.avatar-sheet {
  position: relative;
  z-index: 1;
  width: 100%;
  padding-bottom: var(--space-4);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--surface-color);
  overflow: hidden;
}

.sheet-title {
  padding: var(--space-4) var(--space-4) var(--space-1);
  font-size: var(--font-size-lg);
  font-weight: 700;
  text-align: center;
}

.sheet-copy {
  padding: 0 var(--space-4) var(--space-3);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  text-align: center;
}

.sheet-item {
  width: 100%;
  margin: 0;
  padding: var(--space-4);
  background: var(--surface-color);
  color: var(--text-color);
  font-size: var(--font-size-base);
  line-height: 1.6;
  text-align: center;
  border: 0;
  border-top: 1px solid var(--border-color);
  border-radius: 0;
  box-sizing: border-box;
}

.sheet-button {
  display: block;
}

.sheet-button::after {
  border: 0;
}

.sheet-cancel {
  color: var(--muted-color);
}

.row {
  min-height: 92rpx;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
}

.row:last-child {
  border-bottom: 0;
}

.row-label {
  flex: 0 0 auto;
  max-width: 42%;
  color: var(--text-color);
  font-size: var(--font-size-base);
  font-weight: 600;
  line-height: 1.6;
}

.row-value {
  flex: 1;
  min-width: 0;
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  text-align: right;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.pressable {
  transition: opacity 200ms ease, transform 200ms ease;
}

.pressable:active {
  opacity: 0.72;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .pressable {
    transition: none;
  }

  .pressable:active {
    transform: none;
  }
}
</style>
