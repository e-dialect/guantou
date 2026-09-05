<template>
  <view
    v-if="visible"
    class="pane"
  >
    <view class="current-card">
      <view class="current-copy">
        <view class="kicker">
          当前使用
        </view>
        <view class="current-name">
          {{ activeTheme.name }}
        </view>
        <view class="muted">
          全局主题将统一改变导航栏、按钮、卡片、背景、文字色彩。
        </view>
        <view class="filters appearance">
          <view
            v-for="item in appearanceOptions"
            :key="item.value"
            class="chip pressable"
            :class="{ active: appearance === item.value }"
            @tap="$emit('appearance', item.value)"
          >
            {{ item.label }}
          </view>
        </view>
      </view>
      <view
        class="shot shot-sm"
        :class="`shot-${activeTheme.preview}`"
        :style="themePreviewVars(activeTheme)"
      >
        <view class="shot-home">
          <view class="shot-nav" />
          <view class="shot-feed" />
          <view class="shot-feed thin" />
          <view class="shot-tab" />
        </view>
        <view class="shot-me">
          <view class="shot-avatar" />
          <view class="shot-line" />
          <view class="shot-line short" />
        </view>
      </view>
    </view>

    <scroll-view
      scroll-x
      class="filter-scroll"
      :show-scrollbar="false"
    >
      <view class="filter-row">
        <view
          v-for="item in categories"
          :key="item.value"
          class="chip pressable"
          :class="{ active: category === item.value }"
          @tap="$emit('category', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
    </scroll-view>

    <scroll-view
      v-if="category === 'dialect'"
      scroll-x
      class="filter-scroll"
      :show-scrollbar="false"
    >
      <view class="filter-row">
        <view
          v-for="item in dialectRegions"
          :key="item.value"
          class="chip pressable"
          :class="{ active: isRegionChipOn(item.value) }"
          @tap="$emit('region', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
    </scroll-view>

    <scroll-view
      scroll-x
      class="filter-scroll"
      :show-scrollbar="false"
    >
      <view class="filter-row">
        <view
          v-for="item in sortOptions"
          :key="item.value"
          class="chip pressable"
          :class="{ active: themeSort === item.value }"
          @tap="$emit('sort', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
    </scroll-view>

    <view
      v-if="!themes.length"
      class="empty-wrap"
    >
      <ThemeStatusPane
        :scene="emptyScene"
        @action="$emit('empty-action')"
      />
    </view>
    <view
      v-else
      class="theme-grid"
    >
      <view
        v-for="theme in themes"
        :key="theme.id"
        class="theme-card pressable"
        :class="{
          placeholder: isGreyTheme(theme),
          active: theme.id === activeTheme.id,
        }"
        @tap="$emit('open-detail', theme)"
      >
        <view class="shot-wrap">
          <image
            v-if="themeCoverSrc(theme)"
            class="shot shot-photo"
            :class="{ blurred: !theme.available }"
            :src="themeCoverSrc(theme)"
            mode="aspectFill"
            lazy-load
            @error="$emit('preview-error', theme.id)"
          />
          <view
            v-else
            class="shot"
            :class="[`shot-${theme.preview}`, { blurred: !theme.available }]"
            :style="themePreviewVars(theme)"
          >
            <view class="shot-home">
              <view class="shot-nav" />
              <view class="shot-feed" />
              <view class="shot-feed thin" />
              <view class="shot-tab" />
            </view>
            <view class="shot-me">
              <view class="shot-avatar" />
              <view class="shot-line" />
              <view class="shot-line short" />
            </view>
          </view>
          <view
            v-if="catalogBadge(theme)"
            class="soon-overlay"
          >
            {{ catalogBadge(theme) }}
          </view>
        </view>
        <view class="theme-name">
          {{ theme.name }}
        </view>
        <view class="muted">
          {{ theme.description }}
        </view>
        <view class="theme-foot">
          <view class="tag-row">
            <view
              v-for="tag in themeTags(theme)"
              :key="`${theme.id}-${tag.kind}-${tag.label}`"
              class="tag"
              :class="tag.className"
            >
              {{ tag.label }}
            </view>
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <view
              class="icon-btn"
              :class="{
                on: isItemFav('theme', theme.id),
                disabled: !theme.available,
              }"
              @tap="$emit('toggle-favorite', 'theme', theme)"
            >
              {{ isItemFav('theme', theme.id) ? '★' : '☆' }}
            </view>
            <view
              class="icon-btn"
              :class="{ disabled: !theme.available }"
              @tap="$emit('share', 'theme', theme)"
            >
              ↗
            </view>
            <BaseButton
              class="theme-action"
              size="extra-small"
              :variant="themeActionVariant(theme)"
              :disabled="themeActionDisabled(theme)"
              @click="$emit('enable', theme)"
            >
              {{ themeActionLabel(theme) }}
            </BaseButton>
          </view>
        </view>
        <view class="heat-line">
          热度 {{ statsOf('theme', theme).likes }}
        </view>
      </view>
      <view class="coming-card">
        敬请期待
      </view>
    </view>

    <view class="foot-note">
      全局主题会带轻微地域纹理，不会改变录音播放内容；部分组件在微信小程序存在限制。
    </view>
    <view
      v-for="line in footerLines"
      :key="line"
      class="foot-note"
    >
      {{ line }}
    </view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import BaseButton from '@/components/BaseButton.vue';
import ThemeStatusPane from '@/components/ThemeStatusPane.vue';

export default {
  name: 'ThemeCenterGlobalView',
  components: { BaseButton, ThemeStatusPane },
  props: [
    'activeTheme', 'appearance', 'appearanceOptions', 'catalogBadge', 'categories',
    'category', 'dialectRegions', 'emptyScene', 'footerLines', 'isGreyTheme',
    'isItemFav', 'isRegionChipOn', 'sortOptions', 'statsOf', 'themeActionDisabled',
    'themeActionLabel', 'themeActionVariant', 'themeCoverSrc', 'themePreviewVars',
    'themeSort', 'themeTags', 'themes', 'visible',
  ],
  emits: [
    'appearance',
    'category',
    'empty-action',
    'enable',
    'open-detail',
    'preview-error',
    'region',
    'share',
    'sort',
    'toggle-favorite',
  ],
};
</script>
