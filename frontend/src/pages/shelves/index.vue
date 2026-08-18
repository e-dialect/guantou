<template>
  <AppShell
    title="主题集盒"
    active="box"
    action-text="创建"
    @action="openCreate"
  >
    <view
      v-if="showCreate"
      class="create-card"
    >
      <view class="form-title">
        新建集盒
      </view>
      <input
        v-model="draft.title"
        class="field"
        maxlength="120"
        placeholder="标题（必填）"
        :focus="createTitleFocused"
      >
      <textarea
        v-model="draft.description"
        class="field textarea"
        placeholder="简介（选填）"
      />
      <view
        v-if="createError"
        class="field-error"
      >
        {{ createError }}
      </view>
      <view class="form-actions">
        <button
          class="secondary-button"
          :disabled="creating"
          @tap="closeCreate"
        >
          取消
        </button>
        <button
          class="primary-button"
          :disabled="creating"
          @tap="submitCreate"
        >
          {{ creating ? '创建中…' : '创建集盒' }}
        </button>
      </view>
    </view>

    <view
      v-if="loading"
      class="loading-state"
    >
      正在加载集盒…
    </view>
    <view
      v-else-if="loadError"
      class="load-error"
    >
      <text>{{ loadError }}</text>
      <button @tap="refresh">
        重试
      </button>
    </view>
    <template v-else>
      <EntityCard
        v-for="item in shelves"
        :key="item.id"
        type="集盒"
        :title="item.title"
        :description="item.description || '暂无简介'"
        :meta="shelfMeta(item)"
        :item="item"
        @open="toDetail(item.id)"
      />
      <EmptyState
        v-if="!shelves.length"
        title="还没有集盒"
        description="创建一个集盒，按主题收纳义项和精选罐头。"
        action-text="创建第一个集盒"
        @action="openCreate"
      />
    </template>
  </AppShell>
</template>

<script>
import EmptyState from '@/components/EmptyState.vue';
import EntityCard from '@/components/EntityCard.vue';
import AppShell from '@/components/AppShell.vue';
import { requireAuth } from '@/services/authGuard';
import { createShelf, listShelves } from '@/services/guantou';
import { goShelfDetail } from '@/services/navigation';

export function createShelfSlug(userId, now = Date.now(), random = Math.random()) {
  const owner = Number(userId) || 0;
  const nonce = Math.floor(random * 0xFFFFFF).toString(36).padStart(5, '0');
  return `user-${owner}-${Number(now).toString(36)}-${nonce}`;
}

function blankDraft() {
  return { title: '', description: '' };
}

export default {
  components: {
    EmptyState,
    EntityCard,
    AppShell,
  },
  data() {
    return {
      createError: '',
      createTitleFocused: false,
      creating: false,
      draft: blankDraft(),
      loadError: '',
      loading: false,
      shelves: [],
      showCreate: false,
    };
  },
  onLoad() {
    this.refresh();
  },
  methods: {
    async refresh() {
      this.loading = !this.shelves.length;
      this.loadError = '';
      try {
        const response = await listShelves();
        this.shelves = response.results || response || [];
      } catch (error) {
        this.loadError = '集盒加载失败，请重试';
      } finally {
        this.loading = false;
      }
    },
    openCreate() {
      if (!requireAuth('shelf_create', { page: 'shelf_index' })) return;
      this.showCreate = true;
      this.createError = '';
      // #ifdef H5
      this.createTitleFocused = true;
      // #endif
    },
    closeCreate() {
      this.showCreate = false;
      this.createTitleFocused = false;
      this.createError = '';
      this.draft = blankDraft();
    },
    async submitCreate() {
      const title = this.draft.title.trim();
      if (!title) {
        this.createError = '请填写集盒标题';
        return;
      }
      this.creating = true;
      this.createError = '';
      try {
        const shelf = await createShelf({
          title,
          description: this.draft.description.trim(),
          slug: createShelfSlug(uni.getStorageSync('id')),
          shelf_type: 'user',
        });
        this.shelves = [shelf, ...this.shelves.filter((item) => item.id !== shelf.id)];
        this.closeCreate();
        uni.showToast({ title: '集盒已创建', icon: 'success' });
        this.toDetail(shelf.id);
      } catch (error) {
        this.createError = error.data?.title?.message
          || error.data?.slug?.message
          || error.message
          || '创建失败，请重试';
      } finally {
        this.creating = false;
      }
    },
    shelfMeta(item) {
      return `${(item.flavors || []).length} 个义项 · ${(item.cans || []).length} 个罐头`;
    },
    toDetail(id) {
      goShelfDetail(id);
    },
  },
};
</script>

<style scoped>
.create-card {
  margin-bottom: 24rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #ffffff;
}

.form-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.field {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 16rpx;
  border: 1px solid #d9dfd5;
  border-radius: 12rpx;
  padding: 18rpx;
  background: #ffffff;
}

.textarea {
  min-height: 130rpx;
}

.field-error {
  margin-bottom: 14rpx;
  color: #9f3e32;
  font-size: 24rpx;
}

.form-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.form-actions button {
  width: 100%;
  margin: 0;
  font-size: 26rpx;
}

.primary-button {
  background: #1f5c43;
  color: #ffffff;
}

.secondary-button {
  background: #edf1eb;
  color: #425148;
}

.loading-state {
  padding: 70rpx 0;
  text-align: center;
  color: #7a867d;
}

.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx;
  border-radius: 12rpx;
  background: #f8ece8;
  color: #8b4438;
}

.load-error button {
  margin: 0;
  color: #8b4438;
  font-size: 24rpx;
}

/* #ifndef H5 */
.field {
  font-size: 28rpx;
}
/* #endif */
</style>
