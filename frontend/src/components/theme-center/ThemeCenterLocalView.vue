<template>
  <view
    v-if="visible"
    class="pane"
  >
    <view class="intro-card">
      <view class="intro-title">
        局部装扮可单独修改界面组件，不会强制替换整套全局主题
      </view>
      <view class="muted">
        小程序部分原生组件暂不支持自定义装扮。
      </view>
    </view>

    <scroll-view
      scroll-x
      class="filter-scroll"
      :show-scrollbar="false"
    >
      <view class="filter-row">
        <view
          v-for="item in dressCategories"
          :key="item.value"
          class="chip pressable"
          :class="{ active: dressCategory === item.value }"
          @tap="$emit('category', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
    </scroll-view>

    <view
      v-if="showDressItems"
      class="outfit"
    >
      <view class="note-title">
        匹配的局部装扮
      </view>
      <ThemeStatusPane
        v-if="!dressItems.length"
        scene="filter"
        @action="$emit('clear-filters')"
      />
      <view
        v-for="entry in dressItems"
        :key="`filter-dress-${entry.item.id}`"
        class="dress-card pressable"
        :class="{
          placeholder: isGreyEntry(entry),
          disabled: entry.blocked,
        }"
        @tap="$emit('open-entry', entry)"
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
          <view
            class="tag"
            :class="tagClass(entry.item)"
          >
            {{ entry.item.tag }}
          </view>
          <view
            v-if="entry.blocked"
            class="status-line status-blocked"
          >
            小程序暂不支持
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <BaseButton
              class="theme-action"
              size="small"
              :variant="searchActionVariant(entry)"
              :disabled="searchActionDisabled(entry)"
              @click="$emit('enable-entry', entry)"
            >
              {{ searchActionLabel(entry) }}
            </BaseButton>
          </view>
        </view>
      </view>
    </view>

    <view
      v-if="!groups.length"
      class="empty-wrap"
    >
      <ThemeStatusPane scene="dress_coming" />
    </view>
    <view
      v-for="group in groups"
      :key="group.id"
      class="dress-card pressable"
      :class="{ disabled: group.blocked }"
      @tap="$emit('open-dress', group)"
    >
      <view
        class="thumb"
        :class="`thumb-${group.preview}`"
      >
        <view class="thumb-bar" />
        <view class="thumb-card" />
      </view>
      <view class="dress-body">
        <view class="theme-name">
          {{ group.name }}
        </view>
        <view class="muted">
          {{ group.hint }}
        </view>
        <view
          class="status-line"
          :class="group.blocked ? 'status-blocked' : 'status-ready'"
        >
          {{ group.blocked ? '小程序暂不支持该组件装扮' : (group.mpBlocked ? '仅H5可用' : '可用') }}
        </view>
        <view
          v-if="!group.hasLive"
          class="soon-line"
        >
          装扮素材即将上线
        </view>
        <view
          class="theme-action-wrap"
          @tap.stop
        >
          <BaseButton
            class="theme-action"
            size="small"
            :variant="group.blocked ? 'ghost' : 'primary'"
            :disabled="group.blocked"
            @click="$emit('open-dress', group)"
          >
            去设置
          </BaseButton>
        </view>
      </view>
    </view>

    <view class="foot-note">
      你可以自由混搭不同方言风格装扮，例如：江南吴语头像框 + 川渝风格录音卡片。
    </view>
    <view class="foot-note">
      注意：开启「全局主题覆盖局部装扮」会压制自定义局部装扮。
    </view>
    <view
      class="foot-note pressable"
      @tap="$emit('open-mine')"
    >
      当前搭配可在「我的装扮」里查看生效状态。
    </view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import BaseButton from '@/components/BaseButton.vue';
import ThemeStatusPane from '@/components/ThemeStatusPane.vue';

export default {
  name: 'ThemeCenterLocalView',
  components: { BaseButton, ThemeStatusPane },
  props: [
    'dressCategories', 'dressCategory', 'dressItems', 'groups', 'isGreyEntry',
    'searchActionDisabled', 'searchActionLabel', 'searchActionVariant', 'showDressItems',
    'tagClass', 'visible',
  ],
  emits: [
    'category',
    'clear-filters',
    'enable-entry',
    'open-dress',
    'open-entry',
    'open-mine',
  ],
};
</script>
