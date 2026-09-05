<template>
  <view
    v-if="open"
    class="sheet-mask"
    @tap="$emit('close')"
  >
    <view class="sheet-mask-dim" />
    <view
      class="sheet filter-sheet"
      @tap.stop
    >
      <view class="sheet-title">
        筛选与排序
      </view>
      <view class="note-title">
        权限筛选
      </view>
      <view class="filter-row wrap">
        <view
          v-for="item in accessFilters"
          :key="`access-${item.value}`"
          class="chip pressable"
          :class="{ active: draft.access === item.value }"
          @tap="updateDraft('access', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
      <view class="note-title">
        风格分类
      </view>
      <view class="filter-row wrap">
        <view
          v-for="item in categories"
          :key="`style-${item.value}`"
          class="chip pressable"
          :class="{ active: draft.category === item.value }"
          @tap="updateDraft('category', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
      <view class="note-title">
        装扮组件
      </view>
      <view class="filter-row wrap">
        <view
          v-for="item in dressCategories"
          :key="`dress-cat-${item.value}`"
          class="chip pressable"
          :class="{ active: draft.dressCategory === item.value }"
          @tap="updateDraft('dressCategory', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
      <view class="note-title">
        地域方言标签
      </view>
      <view class="muted">
        可多选家乡风格
      </view>
      <view class="filter-row wrap">
        <view
          v-for="item in dialectRegions"
          :key="`region-${item.value}`"
          class="chip pressable"
          :class="{ active: isDraftRegionOn(item.value) }"
          @tap="$emit('toggle-region', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
      <view class="note-title">
        状态筛选
      </view>
      <view class="filter-row wrap">
        <view
          v-for="item in statusFilters"
          :key="`status-${item.value}`"
          class="chip pressable"
          :class="{ active: draft.status === item.value }"
          @tap="updateDraft('status', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
      <view class="note-title">
        排序
      </view>
      <view class="filter-row wrap">
        <view
          v-for="item in sortOptions"
          :key="`sort-${item.value}`"
          class="chip pressable"
          :class="{ active: draft.sort === item.value }"
          @tap="updateDraft('sort', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
      <view class="sheet-actions">
        <BaseButton
          variant="ghost"
          size="small"
          @click="$emit('reset')"
        >
          重置
        </BaseButton>
        <BaseButton
          size="small"
          @click="$emit('confirm')"
        >
          确定
        </BaseButton>
      </view>
    </view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import BaseButton from '@/components/BaseButton.vue';

export default {
  name: 'ThemeCenterFilterSheet',
  components: { BaseButton },
  props: [
    'accessFilters', 'categories', 'dialectRegions', 'draft', 'dressCategories',
    'isDraftRegionOn', 'open', 'sortOptions', 'statusFilters',
  ],
  emits: ['close', 'confirm', 'reset', 'toggle-region', 'update-draft'],
  methods: {
    updateDraft(field, value) {
      this.$emit('update-draft', { field, value });
    },
  },
};
</script>
