<template>
  <view>
    <u-parse :content="text" />
  </view>
</template>

<script>
import { marked } from 'marked';
import uParse from '../utils/u-parse/u-parse.vue';

export default {
  name: 'MarkdownViewer',
  components: {
    uParse,
  },
  props: {
    markdown: {
      type: String,
      default: '',
    },
  },
  computed: {
    text() {
      return marked(this.markdown);
    },
  },
};
</script>

<style scoped>

</style>
