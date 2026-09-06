<template>
  <view
    v-if="visible"
    class="pane"
  >
    <scroll-view
      scroll-x
      class="filter-scroll"
      :show-scrollbar="false"
    >
      <view class="filter-row">
        <view
          v-for="item in filters"
          :key="item.value"
          class="chip pressable"
          :class="{ active: filter === item.value }"
          @tap="$emit('update-filter', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
    </scroll-view>
    <ThemeStatusPane
      v-if="!entries.length"
      scene="favorites"
      @action="$emit('empty-action')"
    />
    <view
      v-for="entry in entries"
      :key="`${entry.kind}-${entry.item.id}`"
      class="dress-card pressable"
      @tap="$emit('open', entry)"
    >
      <view
        class="thumb"
        :class="`thumb-${entry.item.preview}`"
      >
        <view class="thumb-bar" />
        <view class="thumb-card" />
      </view>
      <view class="dress-body">
        <view class="theme-name">
          {{ entry.item.name }}
        </view>
        <view class="muted">
          {{ entry.kind === 'theme' ? '全局主题' : (entry.group?.name || '局部装扮') }}
        </view>
        <view
          class="tag"
          :class="tagClass(entry.item)"
        >
          {{ entry.item.tag }}
        </view>
        <view class="heat-line">
          热度 {{ statsOf(entry.kind, entry.item).likes }}
          · 收藏 {{ statsOf(entry.kind, entry.item).favorites }}
        </view>
        <view
          class="theme-action-wrap"
          @tap.stop
        >
          <BaseButton
            class="icon-btn on"
            size="extra-small"
            variant="light"
            shape="circle"
            :aria-label="`取消收藏${entry.kind === 'theme' ? '主题' : '装扮'}：${entry.item.name}`"
            :disabled="!entry.item.available"
            @click="$emit('toggle-favorite', entry.kind, entry.item)"
          >
            ★
          </BaseButton>
          <BaseButton
            class="icon-btn"
            size="extra-small"
            variant="light"
            shape="circle"
            :aria-label="`分享${entry.kind === 'theme' ? '主题' : '装扮'}：${entry.item.name}`"
            :disabled="!entry.item.available"
            @click="$emit('share', entry.kind, entry.item)"
          >
            ↗
          </BaseButton>
          <BaseButton
            class="theme-action"
            size="small"
            :variant="actionVariant(entry)"
            :disabled="actionDisabled(entry)"
            @click="$emit('enable', entry)"
          >
            {{ actionLabel(entry) }}
          </BaseButton>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import BaseButton from '@/components/BaseButton.vue';
import ThemeStatusPane from '@/components/ThemeStatusPane.vue';

export default {
  name: 'ThemeCenterFavoritesView',
  components: { BaseButton, ThemeStatusPane },
  props: [
    'actionDisabled', 'actionLabel', 'actionVariant', 'entries', 'filter', 'filters',
    'statsOf', 'tagClass', 'visible',
  ],
  emits: [
    'empty-action',
    'enable',
    'open',
    'share',
    'toggle-favorite',
    'update-filter',
  ],
};
</script>
