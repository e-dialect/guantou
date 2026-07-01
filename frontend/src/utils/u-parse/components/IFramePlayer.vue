<template>
  <view>
    <view v-if="visible">
      <button type="warn">
        视频正在加载中……
      </button>
      <web-view
        :src="src"
        style="position: fixed; top:7vh; right: 0vw; height:83vh"
      />
      <button
        style="position: fixed; bottom: 2vh; right: 0vw; z-index: 1024;width: 100vw"
        type="primary"
        @tap="visible=false"
      >
        返回
      </button>
    </view>
    <view v-else>
      <button
        type="link"
        @tap="onTap"
      >
        点击查看视频
      </button>
    </view>
  </view>
</template>

<script>
export default {
  name: 'IFramePlayer',
  props: {
    src: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      visible: false,
    };
  },
  methods: {
    onTap() {
      // #ifdef MP
      uni.setClipboardData({
        data: this.src,
        success() {
          uni.showToast({
            title: '已复制视频链接',
          });
        },
        fail() {
          uni.showToast({
            title: '无法复制链接至剪切板，请手动复制',
            icon: 'fail',
          });
          this.visible = true;
        },
      });
      // #endif
      // #ifndef MP
      this.visible = true;
      // #endif
    },
  },
};
</script>

<style scoped>

</style>
