<template>
  <PageShell title="草稿箱">
    <CanDraftList ref="drafts" />
  </PageShell>
</template>

<script>
import CanDraftList from '@/components/CanDraftList.vue';
import PageShell from '@/components/PageShell.vue';

export default {
  components: { CanDraftList, PageShell },
  onShow() {
    if (this.$refs.drafts) this.$refs.drafts.loadDrafts();
  },
};
</script>
