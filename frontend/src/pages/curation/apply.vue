<template>
  <PageShell title="申请成为整理员">
    <view class="application-intro">
      <view class="eyebrow">
        共同整理
      </view>
      <view class="intro-title">
        申请一块你真正熟悉的范围
      </view>
      <view class="intro-copy">
        整理员不是权威身份，而是在明确范围内核对资料、说明依据的人。
      </view>
      <view class="principle-list">
        <view class="principle-item">
          <view class="principle-mark">
            范
          </view>
          <text>权限有范围</text>
        </view>
        <view class="principle-item">
          <view class="principle-mark">
            期
          </view>
          <text>授权有期限</text>
        </view>
        <view class="principle-item">
          <view class="principle-mark">
            据
          </view>
          <text>判断留依据</text>
        </view>
      </view>
    </view>

    <BaseLoading
      v-if="loading"
      text="正在读取申请与授权记录…"
    />
    <EmptyState
      v-else-if="error"
      title="申请信息暂时没有加载出来"
      :description="error"
      action-text="重新加载"
      @action="load"
    />
    <template v-else>
      <view
        v-if="pendingApplication"
        class="section-card status-card"
      >
        <view class="status-head">
          <view class="status-badge pending">
            审核中
          </view>
          <view class="status-scope">
            {{ applicationScopeLabel(pendingApplication) }}
          </view>
        </view>
        <view class="section-title">
          {{ roleLabel(pendingApplication.role) }}申请已收到
        </view>
        <view class="statement-label">
          你的申请说明
        </view>
        <view class="statement-copy">
          {{ pendingApplication.statement }}
        </view>
        <view class="application-time">
          提交于 {{ dateLabel(pendingApplication.created_at) }}
        </view>
        <view class="next-step">
          <view class="next-step-title">
            接下来
          </view>
          <view class="next-step-copy">
            审核结果会附带理由；通过后默认授权一年，范围与期限会公开展示。
          </view>
        </view>
        <BaseButton
          class="withdraw-action"
          variant="danger-ghost"
          size="small"
          :loading="withdrawing"
          :disabled="withdrawing"
          text="撤回这份申请"
          @click="withdraw"
        />
      </view>

      <BaseForm
        v-else
        class="application-form"
        :data="form"
      >
        <view class="section-card">
          <view class="section-kicker">
            第一步
          </view>
          <view class="section-title">
            选择你能负责的整理范围
          </view>
          <view class="role-row">
            <BaseButton
              block
              :variant="form.role === 'lexical_curator' ? 'primary' : 'ghost'"
              text="词条整理"
              aria-label="选择词条整理权限"
              @click="selectRole('lexical_curator')"
            />
            <BaseButton
              block
              :variant="form.role === 'regional_curator' ? 'primary' : 'ghost'"
              text="地区整理"
              aria-label="选择地区整理权限"
              @click="selectRole('regional_curator')"
            />
          </view>
          <view class="role-explainer">
            <view class="role-name">
              {{ roleLabel(form.role) }}
            </view>
            <view class="role-copy">
              {{ roleDescription(form.role) }}
            </view>
          </view>

          <view
            v-if="form.role === 'regional_curator'"
            class="dialect-field"
          >
            <view class="field-label">
              申请地区范围
            </view>
            <view class="field-help">
              可以停在你确定的上一级；范围不会自动推断所有下级都使用。
            </view>
            <BaseButton
              block
              variant="ghost"
              :text="selectedDialectLabel || '逐级选择地区范围'"
              @click="pickerVisible = true"
            />
            <view
              v-if="errors.dialect_id"
              class="field-error"
            >
              {{ errors.dialect_id }}
            </view>
          </view>
        </view>

        <view class="section-card statement-card">
          <view class="section-kicker">
            第二步
          </view>
          <view class="section-title">
            说明你熟悉什么、如何核对
          </view>
          <BaseField
            v-model="form.statement"
            name="statement"
            type="textarea"
            label="申请说明"
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
            label="可核对的经历（可选）"
            :maxlength="500"
            placeholder="例如：整理家族口述、查阅地方志、参与田野记录"
          />
          <view class="submit-note">
            提交后可在审核前撤回；审核结论与理由会保留在你的申请记录中。
          </view>
          <BaseButton
            block
            :loading="submitting"
            :disabled="submitting"
            text="提交整理权限申请"
            @click="submit"
          />
        </view>
      </BaseForm>

      <view
        v-if="resolvedApplications.length"
        class="section-card"
      >
        <view class="section-heading">
          <view>
            <view class="section-kicker">
              我的记录
            </view>
            <view class="section-title">
              过往申请
            </view>
          </view>
          <view class="section-count">
            {{ resolvedApplications.length }} 份
          </view>
        </view>
        <view
          v-for="application in resolvedApplications"
          :key="application.id"
          class="record-row"
        >
          <view class="record-head">
            <view class="record-title">
              {{ roleLabel(application.role) }}
            </view>
            <view :class="['status-badge', application.status]">
              {{ statusLabel(application.status) }}
            </view>
          </view>
          <view class="record-scope">
            {{ applicationScopeLabel(application) }}
          </view>
          <view
            v-if="application.review_reason"
            class="review-note"
          >
            <view class="review-note-label">
              审核说明
            </view>
            <view>{{ application.review_reason }}</view>
          </view>
          <view class="record-time">
            申请于 {{ dateLabel(application.created_at) }}
          </view>
        </view>
      </view>

      <view class="section-card public-grants">
        <view class="section-heading">
          <view>
            <view class="section-kicker">
              公开透明
            </view>
            <view class="section-title">
              当前有效授权
            </view>
          </view>
          <view
            v-if="grants.length"
            class="section-count"
          >
            {{ grants.length }} 人
          </view>
        </view>
        <view class="section-description">
          账号、范围、授权理由和有效期公开，方便社区理解每次整理判断的来源。
        </view>
        <view
          v-if="!grants.length"
          class="inline-empty"
        >
          暂时没有可显示的有效授权。
        </view>
        <view
          v-for="grant in grants"
          :key="grant.id"
          class="record-row grant-row"
        >
          <view class="record-head">
            <view class="record-title">
              {{ grant.user?.nickname || grant.user?.username || '未命名整理员' }}
            </view>
            <view class="role-badge">
              {{ roleLabel(grant.role) }}
            </view>
          </view>
          <view class="record-scope">
            {{ grant.dialect ? dialectCardLabel(grant.dialect) : '全站词条范围' }}
          </view>
          <view class="grant-reason">
            {{ grant.reason }}
          </view>
          <view class="record-time">
            有效期 {{ dateLabel(grant.valid_from) }}—{{ dateLabel(grant.valid_until) }}
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
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import {
  createCuratorApplication,
  listCuratorApplications,
  listCuratorGrants,
  pageResults,
  withdrawCuratorApplication,
} from '@/services/entryRecording';
import { confirm as confirmAction, notify, notifySuccess } from '@/services/feedback';
import { listAllDialects } from '@/services/guantou';
import { dialectCardLabel } from '@/utils/dialectTree';

export default {
  components: {
    BaseButton, BaseField, BaseForm, BaseLoading, DialectSelector, EmptyState, PageShell,
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
      error: '',
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
    roleDescription(role) {
      return role === 'lexical_curator'
        ? '核对写法、义项和资料来源，适合能持续查证文献与口述材料的人。'
        : '只处理获授权地区内的读音与使用范围，适合熟悉当地真实说法的人。';
    },
    applicationScopeLabel(application) {
      return application?.dialect
        ? dialectCardLabel(application.dialect, this.dialects)
        : '全站词条范围';
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
      this.error = '';
      this.applications = [];
      this.grants = [];
      this.dialects = [];
      try {
        const [applications, grants, dialects] = await Promise.all([
          listCuratorApplications(), listCuratorGrants({ active: true }), listAllDialects(),
        ]);
        this.applications = pageResults(applications);
        this.grants = pageResults(grants);
        this.dialects = Array.isArray(dialects) ? dialects : pageResults(dialects);
      } catch (error) {
        this.error = error?.message || '请检查网络或登录状态后重试';
      } finally {
        this.loading = false;
      }
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
        notifySuccess('申请已提交，等待审核');
        await this.load();
      } catch (error) {
        notify({ title: error?.message || '申请提交失败' });
      } finally {
        this.submitting = false;
      }
    },
    async withdraw() {
      if (!this.pendingApplication || this.withdrawing) return;
      const confirmed = await confirmAction({
        title: '撤回这份申请？',
        content: '撤回后本次申请会进入历史记录；如果仍想参与整理，需要重新提交。',
        confirmText: '确认撤回',
        danger: true,
      });
      if (!confirmed) return;
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
.application-intro {
  padding: var(--space-4);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
}

.eyebrow,
.section-kicker,
.field-label,
.statement-label,
.review-note-label {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
}

.intro-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-xl);
  font-weight: 900;
  line-height: 1.35;
}

.intro-copy,
.role-copy,
.field-help,
.section-description,
.statement-copy,
.next-step-copy,
.grant-reason {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.intro-copy {
  margin-top: var(--space-1);
}

.principle-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-1);
  margin-top: var(--space-3);
}

.principle-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
}

.principle-mark {
  display: flex;
  width: 36rpx;
  height: 36rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-color);
  color: var(--accent-color);
  font-size: 20rpx;
  font-weight: 800;
}

.section-card {
  margin-top: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.section-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
  line-height: 1.45;
}

.section-heading,
.status-head,
.record-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.section-count,
.status-scope {
  flex: 0 0 auto;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.section-description {
  margin-top: var(--space-2);
}

.status-badge,
.role-badge {
  display: inline-flex;
  flex: 0 0 auto;
  padding: 6rpx var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.status-badge.pending,
.status-badge.approved,
.role-badge {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.status-badge.rejected {
  background: var(--danger-subtle-color);
  color: var(--danger-color);
}

.statement-label {
  margin-top: var(--space-3);
  color: var(--muted-color);
  letter-spacing: 0;
}

.statement-copy {
  margin-top: var(--space-1);
  color: var(--text-color);
}

.application-time,
.record-time,
.record-scope,
.submit-note,
.inline-empty {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.application-time,
.record-time {
  margin-top: var(--space-2);
}

.next-step,
.role-explainer,
.review-note {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
}

.next-step-title,
.role-name,
.record-title {
  color: var(--text-color);
  font-weight: 800;
}

.next-step-copy,
.role-copy {
  margin-top: var(--space-1);
}

.withdraw-action {
  margin-top: var(--space-3);
}

.role-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.dialect-field {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-color);
}

.field-help {
  margin: var(--space-1) 0 var(--space-2);
}

.field-error {
  margin-top: var(--space-1);
  color: var(--danger-color);
  font-size: var(--font-size-xs);
}

.statement-card :deep(.base-field) {
  margin-top: var(--space-3);
}

.submit-note {
  margin: var(--space-3) 0 var(--space-2);
}

.record-row {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
}

.record-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.record-scope {
  margin-top: var(--space-1);
}

.review-note {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.review-note-label {
  margin-bottom: var(--space-1);
  color: var(--muted-color);
  letter-spacing: 0;
}

.inline-empty {
  margin-top: var(--space-3);
  padding: var(--space-4) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  text-align: center;
}

.grant-reason {
  margin-top: var(--space-2);
}
</style>
