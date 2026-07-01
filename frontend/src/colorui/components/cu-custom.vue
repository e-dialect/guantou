<template>
  <view
    :style="`height: ${CustomBar}px`+''"
    class="cu-custom"
  >
    <view
      :class="'cu-bar fixed ' + (bgImage ? 'none-bg text-white bg-img' : '') + ' ' + bgColor"
      :style="`height: ${CustomBar}px;padding-top: ${StatusBar}px;` + (bgImage ? `background-image: url(${bgImage})` : '')"
    >
      <view
        class="action"
      >
        <text
          class="cuIcon-back"
          @tap="BackPage"
          v-if="isBack"
        />
        <text
          v-if="backHome"
          class="cuIcon-home"
          @tap="toIndexPage(true)"
        />
        <slot name="backText" />
      </view>
      <view
        :style="`top: ${StatusBar}px; height: ${CustomBar - StatusBar}px; line-height: ${CustomBar - StatusBar}px;`+''"
        class="content"
      >
        <slot name="content" />
        <text
          v-if="title"
          class="text-black"
        >
          {{ title }}
        </text>
      </view>
      <slot name="right" />
    </view>
  </view>
</template>

<script>
import { toIndexPage } from '@/routers';

const app = getApp();
export default {
  /**
   * 组件的对外属性
   */
  props: {
    bgColor: {
      type: String,
      default: 'bg-white',
    },
    isCustom: {
      type: [Boolean, String],
      default: false,
    },
    isBack: {
      type: [Boolean, String],
      default: true,
    },
    backHome: {
      type: Boolean,
      default: false,
    },
    bgImage: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      StatusBar: app.globalData.StatusBar,
      CustomBar: app.globalData.CustomBar,
      Custom: app.globalData.Custom,
    };
  },
  /**
   * 组件的一些选项
   */
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
  /**
   * 组件的方法列表
   */
  methods: {
    toIndexPage,
    BackPage() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack({
          delta: 1,
        });
      } else {
        toIndexPage();
      }
    },
  },
};
</script>
