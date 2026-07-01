<!--**
 * forked from：https://github.com/F-loat/mpvue-wxParse
 *
 * github地址: https://github.com/dcloudio/uParse
 *
 * for: uni-app框架下 富文本解析
 */-->

<template>
  <!--基础元素-->
  <div
    v-if="!loading"
    :class="className"
    class="wxParse"
  >
    <block
      v-for="(node,index) of nodes"
      :key="index"
    >
      <wxParseTemplate :node="node" />
    </block>
  </div>
</template>

<script>
import HtmlToJson from './libs/html2json';
import wxParseTemplate from './components/wxParseMarkdown.vue';

export default {
  name: 'WxParse',
  components: {
    wxParseTemplate,
  },
  props: {
    loading: {
      type: Boolean,
      default: false,
    },
    className: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
    noData: {
      type: String,
      default: '<div>这里暂时空空如也~</div>',
    },
    startHandler: {
      type: Function,
      default() {
        return (node) => {
          node.attr.class = null;
          node.attr.style = null;
        };
      },
    },
    endHandler: {
      type: Function,
      default: null,
    },
    charsHandler: {
      type: Function,
      default: null,
    },
    imageProp: {
      type: Object,
      default() {
        return {
          mode: 'aspectFit',
          padding: 0,
          lazyLoad: false,
          domain: '',
        };
      },
    },
  },
  computed: {
    results() {
      const {
        content,
        noData,
        imageProp,
        startHandler,
        endHandler,
        charsHandler,
      } = this;
      const parseData = content || noData;
      const customHandler = {
        start: startHandler,
        end: endHandler,
        chars: charsHandler,
      };
      return HtmlToJson(parseData, customHandler, imageProp, this);
    },
    nodes() {
      return this.results.nodes;
    },
    imageUrls() {
      return this.results.imageUrls;
    },

  },
  methods: {
    navigate(href, $event) {
      this.$emit('navigate', href, $event);
    },
    preview(src, $event) {
      if (!this.imageUrls.length) return;
      uni.previewImage({
        current: src,
        urls: this.imageUrls,
      });
      this.$emit('preview', src, $event);
    },
    removeImageUrl(src) {
      const { imageUrls } = this;
      imageUrls.splice(imageUrls.indexOf(src), 1);
    },
  },
};
</script>
