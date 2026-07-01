<template>
  <!--判断是否是标签节点-->
  <block v-if="node.node === 'element'">
    <block v-if="node.tag === 'button'">
      <button
        size="mini"
        type="default"
      >
        <block
          v-for="(node, index) of node.nodes"
          :key="index"
        >
          <wxParseMarkdown :node="node" />
        </block>
      </button>
    </block>

    <!--li类型-->
    <block v-else-if="node.tag === 'li'">
      <view
        :class="node.classStr"
        :style="node.styleStr"
      >
        <block
          v-for="(node, index) of node.nodes"
          :key="index"
        >
          <wxParseMarkdown :node="node" />
        </block>
      </view>
    </block>

    <!--video类型-->
    <block v-else-if="node.tag === 'video'">
      <wx-parse-video :node="node" />
    </block>

    <!--audio类型-->
    <block v-else-if="node.tag === 'audio'">
      <wx-parse-audio :node="node" />
    </block>

    <!--img类型-->
    <block v-else-if="node.tag === 'img'">
      <wx-parse-img :node="node" />
    </block>

    <!--a类型-->
    <block v-else-if="node.tag === 'a'">
      <view
        :class="node.classStr"
        :data-href="node.attr.href"
        :style="node.styleStr"
        @tap="openURL(node.attr.href)"
      >
        <block
          v-for="(node, index) of node.nodes"
          :key="index"
        >
          <wxParseMarkdown :node="node" />
        </block>
      </view>
    </block>

    <!--table类型-->
    <block v-else-if="node.tag === 'table'">
      <view
        :class="node.classStr"
        :style="node.styleStr"
        class="table"
      >
        <block
          v-for="(node, index) of node.nodes"
          :key="index"
        >
          <wxParseMarkdown :node="node" />
        </block>
      </view>
    </block>

    <!--br类型-->
    <block v-else-if="node.tag === 'br'">
      <text>\n</text>
    </block>

    <!--code类型-->
    <block v-else-if="node.tag === 'code'">
      <view
        :class="node.classStr"
        :style="node.styleStr"
      >
        <block
          v-for="(node, index) of node.nodes"
          :key="index"
        >
          <wxParseMarkdown :node="node" />
        </block>
      </view>
    </block>

    <!--iframe类型-->
    <block v-else-if="node.tag === 'iframe'">
      <view style="width:100%">
        <i-frame-player :src="node.attr.src" />
      </view>
    </block>

    <!--其他标签-->
    <block v-else>
      <view
        :class="node.classStr"
        :style="node.styleStr"
      >
        <block
          v-for="(node, index) of node.nodes"
          :key="index"
        >
          <wxParseMarkdown :node="node" />
        </block>
      </view>
    </block>
  </block>

  <!--判断是否是文本节点-->
  <block
    v-else-if="node.node === 'text'"
    style="display: inline-block"
  >
    {{ node.text }}
  </block>
</template>

<script>
import wxParseImg from './wxParseImg.vue';
import wxParseVideo from './wxParseVideo.vue';
import wxParseAudio from './wxParseAudio.vue';
import IFramePlayer from './IFramePlayer.vue';

export default {
  name: 'WxParseMarkdown',
  components: {
    IFramePlayer,
    wxParseImg,
    wxParseVideo,
    wxParseAudio,
  },
  props: {
    node: {},
  },
  methods: {
    /**
     * 打开URL
     * @param href {String} 要打开的URL
     */
    openURL(href) {
      // #ifdef H5
      window.open(href);
      // #endif

      // #ifndef H5
      uni.setClipboardData({
        data: href,
        success() {
          uni.showToast({
            title: '链接已复制！请在浏览器中打开',
            icon: 'success',
            duration: 2000,
          });
        },
      });
      // #endif
    },
  },
};
</script>

<style>
.code {
  background-color: #eee;
  padding: 0 5rpx;
  border-radius: 5%;
  margin: 3rpx 10rpx;
  display: inline-block;
}
</style>
