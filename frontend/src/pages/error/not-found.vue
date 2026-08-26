<template>
  <PageShell
    title="页面不存在"
    :show-back="false"
  >
    <EmptyState
      title="页面不存在"
      description="您访问的页面不存在，请检查链接是否正确。"
      action-text="返回首页"
      @action="goHome"
    />
  </PageShell>
</template>

<script>
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import { toIndexPage } from '@/routers';

export default {
  name: 'NotFoundPage',
  components: { EmptyState, PageShell },
  methods: {
    goHome() {
      toIndexPage();
    },
  },
};
</script>
