<template>
  <PageShell title="申请成为整理员">
    <view class="intro card">
      <view class="eyebrow">
        共同整理，不争权威
      </view>
      <view class="title">
        把你熟悉的部分说明清楚
      </view>
      <view class="copy">
        词条整理员核对写法、义项和来源；地区整理员只处理获授权范围内的读音与使用地区。授权默认一年，账号、范围、理由和期限公开。
      </view>
    </view>

    <view
      v-if="loading"
      class="card muted"
    >
      正在读取申请记录…
    </view>
    <template v-else>
      <view
        v-if="pendingApplication"
        class="card"
      >
        <view class="eyebrow">
          待审核申请
        </view>
        <view class="title">
          {{ roleLabel(pendingApplication.role) }}
        </view>
        <view class="copy">
          {{ pendingApplication.statement }}
        </view>
        <view class="meta">
          提交于 {{ dateLabel(pendingApplication.created_at) }}
        </view>
        <BaseButton
          class="action"
          variant="ghost"
          size="small"
          :loading="withdrawing"
          text="撤回这份申请"
          @click="withdraw"
        />
      </view>

      <BaseForm
        v-else
        :data="form"
      >
        <view class="card">
          <view class="field-label">
            申请哪一种整理权限
          </view>
          <view class="role-row">
            <BaseButton
              :variant="form.role === 'lexical_curator' ? 'primary' : 'ghost'"
              text="词条整理"
              @click="selectRole('lexical_curator')"
            />
            <BaseButton
              :variant="form.role === 'regional_curator' ? 'primary' : 'ghost'"
              text="地区整理"
              @click="selectRole('regional_curator')"
            />
          </view>
          <view class="help">
            {{ form.role === 'lexical_curator' ? '适合能考据写法、区分读音身份与义项的人。' : '适合熟悉特定地区真实说法与口音的人。' }}
          </view>

          <view
            v-if="form.role === 'regional_curator'"
            class="dialect-field"
          >
            <view class="field-label">
              申请地区范围
            </view>
            <view class="help">
              可以停在你确定的上一级，不能据此推断所有下级都使用。
            </view>
            <BaseButton
              block
              variant="ghost"
              :text="selectedDialectLabel || '逐级选择地区范围'"
              @click="pickerVisible = true"
            />
            <view
              v-if="errors.dialect_id"
              class="error"
            >
              {{ errors.dialect_id }}
            </view>
          </view>

          <BaseField
            v-model="form.statement"
            name="statement"
            type="textarea"
            label="为什么适合参与整理"
            required
            :maxlength="500"
            placeholder="说明你熟悉的方言、写法、读音或资料，至少 20 个字"
            :error="errors.statement"
            @change="errors.statement = ''"
          />
          <BaseField
            v-model="form.experience"
            name="experience"
            type="textarea"
            label="相关经历（可选）"
            :maxlength="500"
            placeholder="例如：整理家族口述、查阅地方志、参与田野记录"
          />
          <BaseButton
            block
            :loading="submitting"
            :disabled="submitting"
            text="提交申请"
            @click="submit"
          />
        </view>
      </BaseForm>

      <view
        v-if="resolvedApplications.length"
        class="card"
      >
        <view class="eyebrow">
          申请记录
        </view>
        <view
          v-for="application in resolvedApplications"
          :key="application.id"
          class="grant-row"
        >
          <view class="grant-title">
            {{ roleLabel(application.role) }} · {{ statusLabel(application.status) }}
          </view>
          <view class="copy">
            {{ application.dialect ? dialectCardLabel(application.dialect) : '词条整理范围' }}
          </view>
          <view
            v-if="application.review_reason"
            class="copy"
          >
            审核说明：{{ application.review_reason }}
          </view>
          <view class="meta">
            {{ dateLabel(application.created_at) }}
          </view>
        </view>
      </view>

      <view class="card">
        <view class="eyebrow">
          公开授权记录
        </view>
        <view
          v-if="!grants.length"
          class="muted"
        >
          暂时没有可显示的有效授权。
        </view>
        <view
          v-for="grant in grants"
          :key="grant.id"
          class="grant-row"
        >
          <view class="grant-title">
            {{ grant.user?.nickname || grant.user?.username }} · {{ roleLabel(grant.role) }}
          </view>
          <view class="copy">
            {{ grant.dialect ? dialectCardLabel(grant.dialect) : '全站词条范围' }} · {{ grant.reason }}
          </view>
          <view class="meta">
            {{ dateLabel(grant.valid_from) }}—{{ dateLabel(grant.valid_until) }}
          </view>
        </view>
      </view>
    </template>

    <DialectSelector
      v-model:visible="pickerVisible"
      :value="form.dialect_id"
      :dialects="dialects"
      :default-dialect="primaryDialect"
      owner-scope="curator-application"
      title="选择申请地区范围"
      @change="onDialectChange"
    />
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import {
  createCuratorApplication,
  listCuratorApplications,
  listCuratorGrants,
  pageResults,
  withdrawCuratorApplication,
} from '@/services/entryRecording';
import { notify, notifySuccess } from '@/services/feedback';
import { listAllDialects } from '@/services/guantou';
import { dialectCardLabel } from '@/utils/dialectTree';

export default {
  components: {
    PageShell, BaseButton, BaseField, BaseForm, DialectSelector,
  },
  data() {
    return {
      form: {
        role: 'regional_curator', dialect_id: '', statement: '', experience: '',
      },
      errors: {},
      applications: [],
      grants: [],
      dialects: [],
      pickerVisible: false,
      loading: true,
      submitting: false,
      withdrawing: false,
    };
  },
  computed: {
    pendingApplication() {
      return this.applications.find((item) => item.status === 'pending') || null;
    },
    resolvedApplications() {
      return this.applications.filter((item) => item.status !== 'pending');
    },
    selectedDialect() {
      return this.dialects.find((item) => String(item.id) === String(this.form.dialect_id));
    },
    selectedDialectLabel() {
      return this.selectedDialect ? dialectCardLabel(this.selectedDialect, this.dialects) : '';
    },
    primaryDialect() {
      return typeof getApp === 'function' ? getApp()?.globalData?.userInfo?.primary_dialect : null;
    },
  },
  onLoad() { this.load(); },
  methods: {
    dialectCardLabel,
    roleLabel(role) {
      return role === 'lexical_curator' ? '词条整理员' : '地区整理员';
    },
    statusLabel(status) {
      return ({
        approved: '已通过', rejected: '未通过', withdrawn: '已撤回', pending: '待审核',
      })[status] || status;
    },
    dateLabel(value) { return value ? String(value).slice(0, 10) : '—'; },
    selectRole(role) {
      this.form.role = role;
      if (role === 'lexical_curator') this.form.dialect_id = '';
      this.errors = {};
    },
    onDialectChange({ value }) {
      this.form.dialect_id = value;
      this.errors.dialect_id = '';
    },
    async load() {
      this.loading = true;
      try {
        const [applications, grants, dialects] = await Promise.all([
          listCuratorApplications(), listCuratorGrants({ active: true }), listAllDialects(),
        ]);
        this.applications = pageResults(applications);
        this.grants = pageResults(grants);
        this.dialects = Array.isArray(dialects) ? dialects : pageResults(dialects);
      } catch (error) {
        notify({ title: error?.message || '申请信息加载失败' });
      } finally { this.loading = false; }
    },
    async submit() {
      const statement = this.form.statement.trim();
      this.errors = {};
      if (statement.length < 20) this.errors.statement = '请至少用 20 个字说明你熟悉的内容';
      if (this.form.role === 'regional_curator' && !this.form.dialect_id) {
        this.errors.dialect_id = '请选择申请范围';
      }
      if (Object.keys(this.errors).length) return;
      this.submitting = true;
      try {
        await createCuratorApplication({
          role: this.form.role,
          statement,
          experience: this.form.experience.trim(),
          ...(this.form.role === 'regional_curator'
            ? { dialect_id: Number(this.form.dialect_id) }
            : {}),
        });
        notifySuccess('申请已提交');
        await this.load();
      } catch (error) {
        notify({ title: error?.message || '申请提交失败' });
      } finally {
        this.submitting = false;
      }
    },
    async withdraw() {
      if (!this.pendingApplication) return;
      this.withdrawing = true;
      try {
        await withdrawCuratorApplication(this.pendingApplication.id);
        notifySuccess('申请已撤回');
        await this.load();
      } catch (error) {
        notify({ title: error?.message || '撤回失败' });
      } finally {
        this.withdrawing = false;
      }
    },
  },
};
</script>

<style scoped>
.card {
  margin-bottom: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}
.eyebrow,
.field-label { color: var(--accent-color); font-size: var(--font-size-xs); font-weight: 700; }
.title { margin-top: var(--space-1); font-size: var(--font-size-xl); font-weight: 700; }
.copy, .help, .meta, .muted { color: var(--text-secondary-color); line-height: 1.65; }
.copy { margin-top: var(--space-2); }
.help, .meta { margin-top: var(--space-1); font-size: var(--font-size-xs); }
.role-row { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
.dialect-field, .action { margin-top: var(--space-3); }
.error { margin-top: var(--space-1); color: var(--danger-color); font-size: var(--font-size-xs); }
.grant-row { padding: var(--space-3) 0; border-bottom: 1px solid var(--border-color); }
.grant-row:last-child { border-bottom: 0; }
.grant-title { font-weight: 700; }
</style>
