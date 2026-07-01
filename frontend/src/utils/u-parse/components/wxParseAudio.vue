<template>
  <!--增加audio标签支持-->
  <luch-audio
    :id="node.attr.id"
    :author="node.attr.author"
    :class="node.classStr"
    :loop="node.attr.loop"
    :name="node.attr.name"
    :poster="node.attr.poster"
    :src="node.attr.src"
    :style="node.styleStr"
    controls
  />
</template>

<script>
import LuchAudio from '@/uni_modules/luch-audio/components/luch-audio/luch-audio.vue';

export default {
  name: 'WxParseAudio',
  components: {
    LuchAudio,
  },
  props: {
    node: {
      type: Object,
      default() {
        return {};
      },
    },
  },
};
</script>
