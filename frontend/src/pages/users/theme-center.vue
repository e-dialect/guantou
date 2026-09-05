<template>
  <PageShell
    title="主题中心"
    action-text="搜索"
    :back-fallback="ROUTES.mine"
    :intercept-back="navInterceptBack"
    @action="onSearch"
    @back="onThemeNavBack"
    @scroll="onShellScroll"
  >
    <view class="center">
      <view class="search-bar">
        <BaseForm
          class="search-form"
          :data="searchForm"
        >
          <BaseField
            v-model="searchForm.keyword"
            name="keyword"
            aria-label="搜索主题、装扮名称、方言风格"
            placeholder="搜索主题、装扮名称、方言风格"
            clearable
            :maxlength="64"
            confirm-type="search"
            @confirm="submitThemeSearch"
          />
        </BaseForm>
        <BaseButton
          class="search-go"
          size="small"
          @click="submitThemeSearch"
        >
          搜索
        </BaseButton>
      </view>

      <view
        v-if="memberSyncing"
        class="stale-note"
      >
        会员状态正在同步，请稍候
      </view>
      <view
        v-if="catalogStale && !catalogFail"
        class="stale-note"
      >
        当前展示为缓存数据，部分内容可能不是最新
      </view>
      <BaseLoading
        v-if="catalogLoading && !catalogFail"
        :delay="200"
        text="装扮目录加载中…"
        layout="horizontal"
      />
      <view
        v-if="catalogFail"
        class="empty-wrap"
      >
        <ThemeStatusPane
          scene="catalog_fail"
          @action="retryCatalog"
        />
      </view>

      <scroll-view
        v-if="!catalogFail && !searching && hotKeywords.length"
        scroll-x
        class="filter-scroll hot-scroll"
        :show-scrollbar="false"
      >
        <view class="hot-copy">
          热门搜索词
        </view>
        <view class="filter-row">
          <view
            v-for="tag in hotKeywords"
            :key="tag"
            class="chip pressable"
            @tap="onHotKeyword(tag)"
          >
            {{ tag }}
          </view>
        </view>
      </scroll-view>

      <view
        v-if="!catalogFail && showFilterBar"
        class="filter-toolbar"
      >
        <BaseButton
          size="small"
          variant="ghost"
          @click="openFilterSheet"
        >
          筛选
        </BaseButton>
        <view class="muted">
          {{ filterSummary }}
        </view>
      </view>

      <view
        v-if="!catalogFail && searching"
        class="pane"
      >
        <view class="tabs">
          <view
            v-for="item in searchTabs"
            :key="item.value"
            class="tab pressable"
            :class="{ active: resultTab === item.value }"
            @tap="onResultTab(item.value)"
          >
            {{ item.label }}
          </view>
        </view>
        <ThemeStatusPane
          v-if="!searchRows.length"
          scene="search"
          @action="exitSearch"
        />
        <view
          v-for="entry in searchRows"
          :key="`${entry.kind}-${entry.item.id}`"
          class="dress-card pressable"
          :class="{
            placeholder: isGreyEntry(entry),
            disabled: entry.blocked,
          }"
          @tap="onOpenSearchEntry(entry)"
        >
          <view
            v-if="entry.kind === 'theme'"
            class="shot shot-sm"
            :class="[`shot-${entry.item.preview}`, { blurred: !entry.item.available }]"
            :style="themePreviewVars(entry.item)"
          >
            <view class="shot-home">
              <view class="shot-nav" />
              <view class="shot-feed" />
              <view class="shot-tab" />
            </view>
          </view>
          <view
            v-else
            class="thumb"
            :class="`thumb-${entry.item.preview}`"
          >
            <view class="thumb-bar" />
            <view class="thumb-card" />
          </view>
          <view class="dress-body">
            <view class="theme-name">
              {{ entry.item.name }}
            </view>
            <view class="muted">
              {{ entry.kind === 'theme' ? '全局主题' : (entry.group?.name || '局部装扮') }}
            </view>
            <view
              class="tag"
              :class="tagClass(entry.item)"
            >
              {{ entry.item.tag }}
            </view>
            <view
              v-if="entry.blocked"
              class="status-line status-blocked"
            >
              小程序暂不支持
            </view>
            <view
              class="theme-action-wrap"
              @tap.stop
            >
              <BaseButton
                class="theme-action"
                size="small"
                :variant="searchActionVariant(entry)"
                :disabled="searchActionDisabled(entry)"
                @click="onSearchEnable(entry)"
              >
                {{ searchActionLabel(entry) }}
              </BaseButton>
            </view>
          </view>
        </view>
        <view class="theme-action-wrap">
          <BaseButton
            variant="ghost"
            size="small"
            @click="exitSearch"
          >
            返回列表
          </BaseButton>
        </view>
      </view>

      <view
        v-if="!catalogFail && !searching"
        class="tabs"
      >
        <view
          class="tab pressable"
          :class="{ active: tab === 'global' }"
          @tap="onTabSwitch('global')"
        >
          全局主题
        </view>
        <view
          class="tab pressable"
          :class="{ active: tab === 'local' }"
          @tap="onTabSwitch('local')"
        >
          局部装扮
        </view>
        <view
          class="tab pressable"
          :class="{ active: tab === 'favorites' }"
          @tap="onTabSwitch('favorites')"
        >
          我的收藏
        </view>
        <view
          class="tab pressable"
          :class="{ active: tab === 'mine' }"
          @tap="onTabSwitch('mine')"
        >
          我的装扮
        </view>
      </view>

      <view
        v-if="!catalogFail && !searching"
        class="acquire-bar pressable"
        @tap="onAcquire"
      >
        <view class="acquire-copy">
          <view class="acquire-title">
            装扮获取
          </view>
          <view class="muted">
            活动、会员与方言创作任务
          </view>
        </view>
        <view class="acquire-go">
          去看看
        </view>
      </view>

      <view
        v-if="!catalogFail && !searching && (tab === 'global' || tab === 'local')"
        class="recent-block"
      >
        <view class="note-title">
          最近使用
        </view>
        <ThemeStatusPane
          v-if="!recentRows.length"
          scene="recent"
        />
        <scroll-view
          v-else
          scroll-x
          class="recent-scroll"
          :show-scrollbar="false"
        >
          <view class="recent-row">
            <view
              v-for="row in recentRows"
              :key="`${row.kind}-${row.id}`"
              class="recent-card"
              :class="{ disabled: row.disabled }"
              @tap="onRecentTap(row)"
            >
              <image
                v-if="row.kind === 'theme' && themeCoverSrc(row.item)"
                class="shot shot-xs shot-photo"
                :src="themeCoverSrc(row.item)"
                mode="aspectFill"
                lazy-load
                @error="onPreviewImgError(row.id)"
              />
              <view
                v-else-if="row.kind === 'theme'"
                class="shot shot-xs"
                :class="`shot-${row.preview}`"
                :style="themePreviewVars(row.item)"
              >
                <view class="shot-home">
                  <view class="shot-nav" />
                  <view class="shot-feed" />
                  <view class="shot-tab" />
                </view>
              </view>
              <image
                v-else-if="themeCoverSrc(row.item)"
                class="thumb thumb-xs shot-photo"
                :src="themeCoverSrc(row.item)"
                mode="aspectFill"
                lazy-load
                @error="onPreviewImgError(row.id)"
              />
              <view
                v-else
                class="thumb thumb-xs"
                :class="`thumb-${row.preview}`"
              >
                <view class="thumb-bar" />
                <view class="thumb-card" />
              </view>
              <view class="recent-name">
                {{ row.name }}
              </view>
              <view
                class="tag"
                :class="recentTagClass(row)"
              >
                {{ row.label }}
              </view>
              <view
                v-if="row.hint"
                class="recent-hint"
              >
                {{ row.hint }}
              </view>
              <view
                class="theme-action-wrap"
                @tap.stop
              >
                <BaseButton
                  class="theme-action"
                  size="extra-small"
                  :variant="row.disabled ? 'ghost' : 'primary'"
                  :disabled="row.disabled"
                  @click="onApplyRecent(row)"
                >
                  应用
                </BaseButton>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view
        v-if="!catalogFail && !searching && tab === 'global'"
        class="pane"
      >
        <view class="current-card">
          <view class="current-copy">
            <view class="kicker">
              当前使用
            </view>
            <view class="current-name">
              {{ activeTheme.name }}
            </view>
            <view class="muted">
              全局主题将统一改变导航栏、按钮、卡片、背景、文字色彩。
            </view>
            <view class="filters appearance">
              <view
                v-for="item in appearanceOptions"
                :key="item.value"
                class="chip pressable"
                :class="{ active: appearance === item.value }"
                @tap="onAppearance(item.value)"
              >
                {{ item.label }}
              </view>
            </view>
          </view>
          <view
            class="shot shot-sm"
            :class="`shot-${activeTheme.preview}`"
            :style="themePreviewVars(activeTheme)"
          >
            <view class="shot-home">
              <view class="shot-nav" />
              <view class="shot-feed" />
              <view class="shot-feed thin" />
              <view class="shot-tab" />
            </view>
            <view class="shot-me">
              <view class="shot-avatar" />
              <view class="shot-line" />
              <view class="shot-line short" />
            </view>
          </view>
        </view>

        <scroll-view
          scroll-x
          class="filter-scroll"
          :show-scrollbar="false"
        >
          <view class="filter-row">
            <view
              v-for="item in categories"
              :key="item.value"
              class="chip pressable"
              :class="{ active: category === item.value }"
              @tap="onThemeCategory(item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </scroll-view>

        <scroll-view
          v-if="category === 'dialect'"
          scroll-x
          class="filter-scroll"
          :show-scrollbar="false"
        >
          <view class="filter-row">
            <view
              v-for="item in dialectRegions"
              :key="item.value"
              class="chip pressable"
              :class="{ active: isRegionChipOn(item.value) }"
              @tap="onThemeRegion(item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </scroll-view>

        <scroll-view
          scroll-x
          class="filter-scroll"
          :show-scrollbar="false"
        >
          <view class="filter-row">
            <view
              v-for="item in sortOptions"
              :key="item.value"
              class="chip pressable"
              :class="{ active: themeSort === item.value }"
              @tap="onThemeSort(item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </scroll-view>

        <view
          v-if="!visibleThemes.length"
          class="empty-wrap"
        >
          <ThemeStatusPane
            :scene="themeListEmptyScene"
            @action="onThemeListEmptyAction"
          />
        </view>
        <view
          v-else
          class="theme-grid"
        >
          <view
            v-for="theme in visibleThemes"
            :key="theme.id"
            class="theme-card pressable"
            :class="{
              placeholder: isGreyTheme(theme),
              active: theme.id === activeTheme.id,
            }"
            @tap="openDetail(theme)"
          >
            <view class="shot-wrap">
              <image
                v-if="themeCoverSrc(theme)"
                class="shot shot-photo"
                :class="{ blurred: !theme.available }"
                :src="themeCoverSrc(theme)"
                mode="aspectFill"
                lazy-load
                @error="onPreviewImgError(theme.id)"
              />
              <view
                v-else
                class="shot"
                :class="[`shot-${theme.preview}`, { blurred: !theme.available }]"
                :style="themePreviewVars(theme)"
              >
                <view class="shot-home">
                  <view class="shot-nav" />
                  <view class="shot-feed" />
                  <view class="shot-feed thin" />
                  <view class="shot-tab" />
                </view>
                <view class="shot-me">
                  <view class="shot-avatar" />
                  <view class="shot-line" />
                  <view class="shot-line short" />
                </view>
              </view>
              <view
                v-if="catalogBadge(theme)"
                class="soon-overlay"
              >
                {{ catalogBadge(theme) }}
              </view>
            </view>
            <view class="theme-name">
              {{ theme.name }}
            </view>
            <view class="muted">
              {{ theme.description }}
            </view>
            <view class="theme-foot">
              <view class="tag-row">
                <view
                  v-for="tag in themeTags(theme)"
                  :key="`${theme.id}-${tag.kind}-${tag.label}`"
                  class="tag"
                  :class="tag.className"
                >
                  {{ tag.label }}
                </view>
              </view>
              <view
                class="theme-action-wrap"
                @tap.stop
              >
                <view
                  class="icon-btn"
                  :class="{
                    on: isItemFav('theme', theme.id),
                    disabled: !theme.available,
                  }"
                  @tap="onToggleFavorite('theme', theme)"
                >
                  {{ isItemFav('theme', theme.id) ? '★' : '☆' }}
                </view>
                <view
                  class="icon-btn"
                  :class="{ disabled: !theme.available }"
                  @tap="onShare('theme', theme)"
                >
                  ↗
                </view>
                <BaseButton
                  class="theme-action"
                  size="extra-small"
                  :variant="themeActionVariant(theme)"
                  :disabled="themeActionDisabled(theme)"
                  @click="onCardEnable(theme)"
                >
                  {{ themeActionLabel(theme) }}
                </BaseButton>
              </view>
            </view>
            <view class="heat-line">
              热度 {{ statsOf('theme', theme).likes }}
            </view>
          </view>
          <view class="coming-card">
            敬请期待
          </view>
        </view>

        <view class="foot-note">
          全局主题会带轻微地域纹理，不会改变录音播放内容；部分组件在微信小程序存在限制。
        </view>
      </view>

      <view
        v-else-if="!catalogFail && !searching && tab === 'local'"
        class="pane"
      >
        <view class="intro-card">
          <view class="intro-title">
            局部装扮可单独修改界面组件，不会强制替换整套全局主题
          </view>
          <view class="muted">
            小程序部分原生组件暂不支持自定义装扮。
          </view>
        </view>

        <scroll-view
          scroll-x
          class="filter-scroll"
          :show-scrollbar="false"
        >
          <view class="filter-row">
            <view
              v-for="item in dressCategories"
              :key="item.value"
              class="chip pressable"
              :class="{ active: dressCategory === item.value }"
              @tap="onDressCategory(item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </scroll-view>

        <view
          v-if="showDressItems"
          class="outfit"
        >
          <view class="note-title">
            匹配的局部装扮
          </view>
          <ThemeStatusPane
            v-if="!visibleDressItems.length"
            scene="filter"
            @action="onClearAppliedFilters"
          />
          <view
            v-for="entry in visibleDressItems"
            :key="`filter-dress-${entry.item.id}`"
            class="dress-card pressable"
            :class="{
              placeholder: isGreyEntry(entry),
              disabled: entry.blocked,
            }"
            @tap="onOpenSearchEntry(entry)"
          >
            <view
              class="thumb"
              :class="`thumb-${entry.item.preview}`"
            >
              <view class="thumb-bar" />
              <view class="thumb-card" />
            </view>
            <view class="dress-body">
              <view class="theme-name">
                {{ entry.item.name }}
              </view>
              <view
                class="tag"
                :class="tagClass(entry.item)"
              >
                {{ entry.item.tag }}
              </view>
              <view
                v-if="entry.blocked"
                class="status-line status-blocked"
              >
                小程序暂不支持
              </view>
              <view
                class="theme-action-wrap"
                @tap.stop
              >
                <BaseButton
                  class="theme-action"
                  size="small"
                  :variant="searchActionVariant(entry)"
                  :disabled="searchActionDisabled(entry)"
                  @click="onSearchEnable(entry)"
                >
                  {{ searchActionLabel(entry) }}
                </BaseButton>
              </view>
            </view>
          </view>
        </view>

        <view
          v-if="!dressGroups.length"
          class="empty-wrap"
        >
          <ThemeStatusPane scene="dress_coming" />
        </view>
        <view
          v-for="group in dressGroups"
          :key="group.id"
          class="dress-card pressable"
          :class="{ disabled: group.blocked }"
          @tap="onOpenDress(group)"
        >
          <view
            class="thumb"
            :class="`thumb-${group.preview}`"
          >
            <view class="thumb-bar" />
            <view class="thumb-card" />
          </view>
          <view class="dress-body">
            <view class="theme-name">
              {{ group.name }}
            </view>
            <view class="muted">
              {{ group.hint }}
            </view>
            <view
              class="status-line"
              :class="group.blocked ? 'status-blocked' : 'status-ready'"
            >
              {{ group.blocked ? '小程序暂不支持该组件装扮' : (group.mpBlocked ? '仅H5可用' : '可用') }}
            </view>
            <view
              v-if="!group.hasLive"
              class="soon-line"
            >
              装扮素材即将上线
            </view>
            <view
              class="theme-action-wrap"
              @tap.stop
            >
              <BaseButton
                class="theme-action"
                size="small"
                :variant="group.blocked ? 'ghost' : 'primary'"
                :disabled="group.blocked"
                @click="onOpenDress(group)"
              >
                去设置
              </BaseButton>
            </view>
          </view>
        </view>

        <view class="foot-note">
          你可以自由混搭不同方言风格装扮，例如：江南吴语头像框 + 川渝风格录音卡片。
        </view>
        <view class="foot-note">
          注意：开启「全局主题覆盖局部装扮」会压制自定义局部装扮。
        </view>
        <view
          class="foot-note pressable"
          @tap="onTabSwitch('mine')"
        >
          当前搭配可在「我的装扮」里查看生效状态。
        </view>
      </view>

      <view
        v-else-if="!catalogFail && !searching && tab === 'favorites'"
        class="pane"
      >
        <scroll-view
          scroll-x
          class="filter-scroll"
          :show-scrollbar="false"
        >
          <view class="filter-row">
            <view
              v-for="item in favoriteFilters"
              :key="item.value"
              class="chip pressable"
              :class="{ active: favoriteFilter === item.value }"
              @tap="favoriteFilter = item.value"
            >
              {{ item.label }}
            </view>
          </view>
        </scroll-view>
        <ThemeStatusPane
          v-if="!favoriteEntries.length"
          scene="favorites"
          @action="onFavoriteEmptyAction"
        />
        <view
          v-for="entry in favoriteEntries"
          :key="`${entry.kind}-${entry.item.id}`"
          class="dress-card pressable"
          @tap="onOpenFavorite(entry)"
        >
          <view
            class="thumb"
            :class="`thumb-${entry.item.preview}`"
          >
            <view class="thumb-bar" />
            <view class="thumb-card" />
          </view>
          <view class="dress-body">
            <view class="theme-name">
              {{ entry.item.name }}
            </view>
            <view class="muted">
              {{ entry.kind === 'theme' ? '全局主题' : (entry.group?.name || '局部装扮') }}
            </view>
            <view
              class="tag"
              :class="tagClass(entry.item)"
            >
              {{ entry.item.tag }}
            </view>
            <view class="heat-line">
              热度 {{ statsOf(entry.kind, entry.item).likes }}
              · 收藏 {{ statsOf(entry.kind, entry.item).favorites }}
            </view>
            <view
              class="theme-action-wrap"
              @tap.stop
            >
              <view
                class="icon-btn on"
                @tap="onToggleFavorite(entry.kind, entry.item)"
              >
                ★
              </view>
              <view
                class="icon-btn"
                :class="{ disabled: !entry.item.available }"
                @tap="onShare(entry.kind, entry.item)"
              >
                ↗
              </view>
              <BaseButton
                class="theme-action"
                size="small"
                :variant="favoriteVariant(entry)"
                :disabled="favoriteDisabled(entry)"
                @click="onFavoriteEnable(entry)"
              >
                {{ favoriteActionLabel(entry) }}
              </BaseButton>
            </view>
          </view>
        </view>
      </view>

      <view
        v-else-if="!catalogFail && !searching && tab === 'mine'"
        class="pane"
      >
        <view class="section-title">
          我的装扮
        </view>

        <view class="current-card">
          <view class="current-copy">
            <view class="kicker">
              当前正在使用：{{ activeTheme.name }}
            </view>
            <view class="muted">
              全局主题会统一修改整套界面风格
            </view>
            <view class="tag-row">
              <view
                v-for="tag in themeTags(activeTheme)"
                :key="`mine-theme-${tag.kind}-${tag.label}`"
                class="tag"
                :class="tag.className"
              >
                {{ tag.label }}
              </view>
            </view>
            <view
              class="theme-action-wrap"
              @tap.stop
            >
              <BaseButton
                class="theme-action"
                size="small"
                @click="onChangeTheme"
              >
                更换主题
              </BaseButton>
            </view>
          </view>
          <view
            class="shot shot-sm"
            :class="previewShotClass"
            :style="themePreviewVars(activeTheme)"
          >
            <view class="shot-home">
              <view class="shot-nav" />
              <view class="shot-feed" />
              <view class="shot-feed thin" />
              <view class="shot-tab" />
            </view>
            <view class="shot-me">
              <view class="shot-avatar" />
              <view class="shot-line" />
              <view class="shot-line short" />
            </view>
          </view>
        </view>

        <view class="outfit">
          <view class="note-title">
            已启用局部装扮
          </view>
          <ThemeStatusPane
            v-if="!hasAppliedDress"
            scene="dress_applied"
            @action="onDressAppliedEmptyAction"
          />
          <view
            v-for="entry in appliedDress"
            :key="entry.group.id"
            class="dress-card"
            :class="{ disabled: entry.blocked, empty: entry.empty }"
          >
            <view
              class="thumb"
              :class="entry.item ? `thumb-${entry.item.preview}` : 'thumb-empty'"
            >
              <view class="thumb-bar" />
              <view class="thumb-card" />
            </view>
            <view class="dress-body">
              <view class="theme-name">
                {{ entry.group.name }}
              </view>
              <view class="muted">
                {{ entry.item ? entry.item.name : '暂未设置该组件装扮' }}
              </view>
              <view class="tag-row">
                <view
                  v-for="tag in dressTags(entry)"
                  :key="`${entry.group.id}-${tag.kind}-${tag.label}`"
                  class="tag"
                  :class="tag.className"
                >
                  {{ tag.label }}
                </view>
              </view>
              <view
                class="status-line"
                :class="entry.effective ? 'status-ready' : 'status-blocked'"
              >
                {{ dressStatus(entry) }}
              </view>
              <view
                class="theme-action-wrap"
                @tap.stop
              >
                <BaseButton
                  class="theme-action"
                  size="small"
                  variant="ghost"
                  :disabled="entry.blocked"
                  @click="onEditDress(entry.group, entry)"
                >
                  修改
                </BaseButton>
                <BaseButton
                  v-if="entry.item"
                  class="theme-action"
                  size="small"
                  variant="ghost"
                  @click="onClearDress(entry)"
                >
                  关闭
                </BaseButton>
              </view>
            </view>
          </view>
        </view>

        <view class="outfit">
          <view class="note-title">
            装扮冲突设置
          </view>
          <view class="overlay-row">
            <view class="overlay-copy">
              <view>全局主题覆盖局部装扮</view>
              <view class="muted">
                开启后全站只用当前全局主题；已启用的局部装扮暂时失效，但不会被删除。关闭后，单独设置过的组件优先生效。
              </view>
            </view>
            <t-switch
              :value="overlay"
              @change="onOverlayChange"
            />
          </view>
        </view>

        <view class="action-stack">
          <BaseButton
            @click="onOpenSaveOutfit"
          >
            保存当前搭配
          </BaseButton>
          <BaseButton
            @click="openPreview"
          >
            预览装扮效果
          </BaseButton>
          <BaseButton
            variant="ghost"
            @click="onResetDress"
          >
            重置全部装扮
          </BaseButton>
        </view>

        <view class="outfit">
          <view class="note-title">
            历史搭配
          </view>
          <ThemeStatusPane
            v-if="!savedOutfits.length"
            scene="mix"
            @action="onOpenSaveOutfit"
          />
          <view
            v-for="outfit in savedOutfits"
            :key="outfit.id"
            class="dress-card"
          >
            <view
              class="shot shot-xs"
              :class="`shot-${outfitThemePreview(outfit)}`"
              :style="outfitPreviewVars(outfit)"
            >
              <view class="shot-home">
                <view class="shot-nav" />
                <view class="shot-feed" />
                <view class="shot-tab" />
              </view>
            </view>
            <view class="dress-body">
              <view class="theme-name">
                {{ outfit.name }}
              </view>
              <view class="muted">
                {{ outfitSummary(outfit) }}
              </view>
              <view
                class="theme-action-wrap"
                @tap.stop
              >
                <BaseButton
                  class="theme-action"
                  size="extra-small"
                  @click="onApplyOutfit(outfit)"
                >
                  一键应用
                </BaseButton>
                <BaseButton
                  class="theme-action"
                  size="extra-small"
                  variant="ghost"
                  @click="onPreviewOutfit(outfit)"
                >
                  预览
                </BaseButton>
                <BaseButton
                  class="theme-action"
                  size="extra-small"
                  variant="ghost"
                  @click="onOpenRenameOutfit(outfit)"
                >
                  重命名
                </BaseButton>
                <BaseButton
                  class="theme-action"
                  size="extra-small"
                  variant="ghost"
                  @click="onDeleteOutfit(outfit)"
                >
                  删除
                </BaseButton>
              </view>
            </view>
          </view>
        </view>

        <view class="outfit">
          <view class="note-title">
            已拥有未启用
          </view>
          <view
            v-if="!ownedUnused.themes.length && !ownedUnused.dresses.length"
            class="muted"
          >
            暂无已拥有但未启用的装扮
          </view>
          <view
            v-for="theme in ownedUnused.themes"
            :key="`owned-theme-${theme.id}`"
            class="dress-card"
          >
            <view class="dress-body">
              <view class="theme-name">
                {{ theme.name }}
              </view>
              <view
                class="tag"
                :class="tagClass(theme)"
              >
                {{ theme.tag }}
              </view>
              <view
                class="theme-action-wrap"
                @tap.stop
              >
                <BaseButton
                  class="theme-action"
                  size="small"
                  @click="onCardEnable(theme)"
                >
                  应用
                </BaseButton>
              </view>
            </view>
          </view>
          <view
            v-for="entry in ownedUnused.dresses"
            :key="`owned-dress-${entry.item.id}`"
            class="dress-card"
            :class="{ disabled: entry.blocked }"
          >
            <view class="dress-body">
              <view class="theme-name">
                {{ entry.item.name }}
              </view>
              <view class="muted">
                {{ entry.group.name }}
              </view>
              <view
                class="tag"
                :class="tagClass(entry.item)"
              >
                {{ entry.item.tag }}
              </view>
              <view
                v-if="entry.blocked"
                class="status-line status-blocked"
              >
                拥有权限，但小程序暂不支持该装扮
              </view>
              <view
                class="theme-action-wrap"
                @tap.stop
              >
                <BaseButton
                  class="theme-action"
                  size="small"
                  :disabled="entry.blocked"
                  @click="onApplyOwnedDress(entry)"
                >
                  应用
                </BaseButton>
              </view>
            </view>
          </view>
        </view>

        <view class="outfit">
          <view class="note-title">
            未拥有
          </view>
          <view
            v-if="!acquireOffers.themes.length && !acquireOffers.dresses.length"
            class="muted"
          >
            暂无可获取装扮
          </view>
          <view
            v-for="theme in acquireOffers.themes"
            :key="`offer-theme-${theme.id}`"
            class="dress-card"
          >
            <view class="dress-body">
              <view class="theme-name">
                {{ theme.name }}
              </view>
              <view
                class="tag"
                :class="tagClass(theme)"
              >
                {{ theme.tag }}
              </view>
              <view
                class="theme-action-wrap"
                @tap.stop
              >
                <BaseButton
                  class="theme-action"
                  size="small"
                  :variant="themeActionVariant(theme)"
                  :disabled="themeActionDisabled(theme)"
                  @click="onCardEnable(theme)"
                >
                  去获取
                </BaseButton>
              </view>
            </view>
          </view>
          <view
            v-for="item in acquireOffers.dresses"
            :key="`offer-dress-${item.id}`"
            class="dress-card"
          >
            <view class="dress-body">
              <view class="theme-name">
                {{ item.name }}
              </view>
              <view
                class="tag"
                :class="tagClass(item)"
              >
                {{ item.tag }}
              </view>
              <view
                class="theme-action-wrap"
                @tap.stop
              >
                <BaseButton
                  class="theme-action"
                  size="small"
                  :variant="dressActionVariant(item)"
                  :disabled="dressActionDisabled(item)"
                  @click="onDressOffer(item)"
                >
                  去获取
                </BaseButton>
              </view>
            </view>
          </view>
        </view>

        <view class="foot-note">
          提示：微信小程序部分原生组件不支持自定义装扮，该部分样式保持系统默认，不会受装扮影响。
        </view>
        <view class="foot-note">
          {{ accountSyncNote }}
        </view>
      </view>

      <view
        v-if="!catalogFail && !searching && tab === 'global'"
      >
        <view
          v-for="line in accessFooter"
          :key="line"
          class="foot-note"
        >
          {{ line }}
        </view>
        <view
          v-for="line in socialFooter"
          :key="line"
          class="foot-note"
        >
          {{ line }}
        </view>
        <view
          v-for="line in historyFooter"
          :key="line"
          class="foot-note"
        >
          {{ line }}
        </view>
        <view
          v-for="line in filterFooter"
          :key="line"
          class="foot-note"
        >
          {{ line }}
        </view>
        <view
          v-for="line in previewFooter"
          :key="line"
          class="foot-note"
        >
          {{ line }}
        </view>
      </view>
    </view>

    <view
      v-if="detailTheme"
      class="sheet-mask"
      @tap="closeDetail"
    >
      <view class="sheet-mask-dim" />
      <view
        class="sheet"
        @tap.stop
      >
        <view class="shot-wrap">
          <view
            class="sheet-tools"
            @tap.stop
          >
            <view
              class="icon-btn"
              :class="{
                on: isItemFav('theme', detailTheme.id),
                disabled: !detailTheme.available,
              }"
              @tap="onToggleFavorite('theme', detailTheme)"
            >
              {{ isItemFav('theme', detailTheme.id) ? '★' : '☆' }}
            </view>
            <view
              class="icon-btn"
              :class="{ disabled: !detailTheme.available }"
              @tap="onShare('theme', detailTheme)"
            >
              ↗
            </view>
          </view>
          <view class="preview-label">
            首页录音流
          </view>
          <view
            class="shot shot-lg pressable"
            :class="[`shot-${detailTheme.preview}`, { blurred: !detailTheme.available }]"
            :style="themePreviewVars(detailTheme)"
            @tap="openZoom"
          >
            <image
              v-if="themeDetailSrc(detailTheme)"
              class="shot-photo"
              :src="themeDetailSrc(detailTheme)"
              mode="aspectFill"
              lazy-load
              @error="onPreviewImgError(`detail:${detailTheme.id}`)"
            />
            <template v-else>
              <view class="shot-home">
                <view class="shot-nav" />
                <view class="shot-feed" />
                <view class="shot-feed thin" />
                <view class="shot-tab" />
              </view>
              <view class="shot-me preview-feed">
                <view class="shot-feed" />
                <view class="shot-feed thin" />
                <view class="shot-tab" />
              </view>
            </template>
          </view>
          <view class="preview-label">
            个人中心
          </view>
          <view
            class="shot shot-lg pressable"
            :class="[`shot-${detailTheme.preview}`, { blurred: !detailTheme.available }]"
            :style="themePreviewVars(detailTheme)"
            @tap="openZoom"
          >
            <view class="shot-me">
              <view class="shot-avatar" />
              <view class="shot-line" />
              <view class="shot-line short" />
              <view class="shot-feed" />
            </view>
            <view class="shot-home">
              <view class="shot-nav" />
              <view class="shot-feed thin" />
              <view class="shot-tab" />
            </view>
          </view>
          <view
            v-if="catalogBadge(detailTheme)"
            class="soon-overlay"
          >
            {{ catalogBadge(detailTheme) }}
          </view>
          <view
            v-if="isMiniProgram"
            class="preview-corner"
          >
            ⚠️小程序部分原生组件为系统默认样式
          </view>
        </view>
        <view class="sheet-title">
          {{ detailTheme.name }}
        </view>
        <view class="muted">
          {{ detailTheme.blurb }}
        </view>
        <view class="muted">
          预览仅为模拟效果，不会修改你的界面
        </view>
        <view class="tag-row">
          <view
            v-for="tag in themeTags(detailTheme)"
            :key="`detail-${tag.kind}-${tag.label}`"
            class="tag"
            :class="tag.className"
          >
            {{ tag.label }}
          </view>
        </view>
        <view
          class="social-stats pressable"
          @tap="onToggleLike('theme', detailTheme)"
        >
          {{ statsOf('theme', detailTheme).liked ? '♥' : '♡' }}
          热度 {{ statsOf('theme', detailTheme).likes }}
          · 收藏 {{ statsOf('theme', detailTheme).favorites }}
        </view>
        <view class="muted">
          喜欢仅代表喜爱，不等于拥有该装扮
        </view>
        <view
          v-if="detailTheme.available && themeAccess(detailTheme).hint"
          class="hint-row"
        >
          {{ themeAccess(detailTheme).hint }}
        </view>
        <view
          v-if="!isMiniProgram"
          class="hint-row"
        >
          H5网页版：该主题全部样式完整生效
        </view>
        <view
          v-else
          class="hint-row warn"
        >
          微信小程序：原生导航栏、底部Tab栏受微信限制，部分样式无法生效
        </view>
        <view class="feature-title">
          会修改的元素
        </view>
        <view
          v-for="item in themeFeatures"
          :key="item"
          class="feature-item"
        >
          {{ item }}
        </view>
        <view
          v-if="!detailTheme.available"
          class="soon-line"
        >
          该主题暂未开放，敬请期待
        </view>
        <view class="sheet-actions">
          <BaseButton
            variant="ghost"
            size="small"
            @click="closeDetail"
          >
            取消
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="small"
            :disabled="!detailTheme.available"
            @click="onToggleFavorite('theme', detailTheme)"
          >
            {{ isItemFav('theme', detailTheme.id) ? '取消收藏' : '加入收藏' }}
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="small"
            :disabled="!detailTheme.available"
            @click="onShare('theme', detailTheme)"
          >
            分享
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="small"
            :disabled="!canLivePreviewItem(detailTheme)"
            @click="openLivePreview('theme', detailTheme)"
          >
            实时预览
          </BaseButton>
          <BaseButton
            size="small"
            :variant="themeActionVariant(detailTheme)"
            :disabled="themeActionDisabled(detailTheme)"
            @click="onCardEnable(detailTheme)"
          >
            {{ themeActionLabel(detailTheme) }}
          </BaseButton>
        </view>
      </view>
    </view>

    <ThemeLivePreview
      v-if="previewOpen"
      :open="true"
      :title="previewTitle"
      :model="livePreviewModel"
      @cancel="closePreview"
      @apply="onConfirmPreview"
    />

    <view
      v-if="zoomOpen && detailTheme"
      class="sheet-mask zoom-mask"
      @tap="closeZoom"
    >
      <view class="sheet-mask-dim" />
      <view
        class="zoom-sheet"
        @tap.stop
      >
        <view
          class="preview-close pressable"
          @tap="closeZoom"
        >
          关闭
        </view>
        <view class="muted">
          {{ zoomHint }}
        </view>
        <movable-area class="zoom-area">
          <movable-view
            class="zoom-view"
            direction="all"
            :scale="true"
            scale-min="1"
            scale-max="3"
          >
            <image
              v-if="themeDetailSrc(detailTheme)"
              class="shot shot-xl shot-photo"
              :src="themeDetailSrc(detailTheme)"
              mode="aspectFit"
            />
            <view
              v-else
              class="shot shot-xl"
              :class="`shot-${detailTheme.preview}`"
              :style="themePreviewVars(detailTheme)"
            >
              <view class="shot-home">
                <view class="shot-nav" />
                <view class="shot-feed" />
                <view class="shot-feed thin" />
                <view class="shot-tab" />
              </view>
              <view class="shot-me">
                <view class="shot-avatar" />
                <view class="shot-line" />
                <view class="shot-line short" />
              </view>
            </view>
          </movable-view>
        </movable-area>
      </view>
    </view>

    <view
      v-if="outfitSheet"
      class="sheet-mask"
      @tap="closeOutfitSheet"
    >
      <view class="sheet-mask-dim" />
      <view
        class="sheet"
        @tap.stop
      >
        <view class="sheet-title">
          {{ outfitMode === 'rename' ? '重命名搭配方案' : '保存当前搭配' }}
        </view>
        <view class="muted">
          将当前全局主题与局部装扮保存为一套方案，方便下次一键还原。
        </view>
        <BaseForm
          :data="outfitForm"
          :rules="outfitRules"
        >
          <BaseField
            v-model="outfitForm.name"
            name="name"
            label="搭配名称"
            required
            clearable
            placeholder="例如：川渝市井全套"
            :maxlength="20"
            :error="outfitError"
          />
        </BaseForm>
        <view class="sheet-actions">
          <BaseButton
            variant="ghost"
            size="small"
            @click="closeOutfitSheet"
          >
            取消
          </BaseButton>
          <BaseButton
            size="small"
            @click="onConfirmOutfitSheet"
          >
            保存
          </BaseButton>
        </view>
      </view>
    </view>

    <view
      v-if="filterSheet"
      class="sheet-mask"
      @tap="closeFilterSheet"
    >
      <view class="sheet-mask-dim" />
      <view
        class="sheet filter-sheet"
        @tap.stop
      >
        <view class="sheet-title">
          筛选与排序
        </view>
        <view class="note-title">
          权限筛选
        </view>
        <view class="filter-row wrap">
          <view
            v-for="item in accessFilters"
            :key="`access-${item.value}`"
            class="chip pressable"
            :class="{ active: filterDraft.access === item.value }"
            @tap="filterDraft.access = item.value"
          >
            {{ item.label }}
          </view>
        </view>
        <view class="note-title">
          风格分类
        </view>
        <view class="filter-row wrap">
          <view
            v-for="item in categories"
            :key="`style-${item.value}`"
            class="chip pressable"
            :class="{ active: filterDraft.category === item.value }"
            @tap="filterDraft.category = item.value"
          >
            {{ item.label }}
          </view>
        </view>
        <view class="note-title">
          装扮组件
        </view>
        <view class="filter-row wrap">
          <view
            v-for="item in dressCategories"
            :key="`dress-cat-${item.value}`"
            class="chip pressable"
            :class="{ active: filterDraft.dressCategory === item.value }"
            @tap="filterDraft.dressCategory = item.value"
          >
            {{ item.label }}
          </view>
        </view>
        <view class="note-title">
          地域方言标签
        </view>
        <view class="muted">
          可多选家乡风格
        </view>
        <view class="filter-row wrap">
          <view
            v-for="item in dialectRegions"
            :key="`region-${item.value}`"
            class="chip pressable"
            :class="{ active: isDraftRegionOn(item.value) }"
            @tap="onToggleDraftRegion(item.value)"
          >
            {{ item.label }}
          </view>
        </view>
        <view class="note-title">
          状态筛选
        </view>
        <view class="filter-row wrap">
          <view
            v-for="item in statusFilters"
            :key="`status-${item.value}`"
            class="chip pressable"
            :class="{ active: filterDraft.status === item.value }"
            @tap="filterDraft.status = item.value"
          >
            {{ item.label }}
          </view>
        </view>
        <view class="note-title">
          排序
        </view>
        <view class="filter-row wrap">
          <view
            v-for="item in sortOptions"
            :key="`sort-${item.value}`"
            class="chip pressable"
            :class="{ active: filterDraft.sort === item.value }"
            @tap="filterDraft.sort = item.value"
          >
            {{ item.label }}
          </view>
        </view>
        <view class="sheet-actions">
          <BaseButton
            variant="ghost"
            size="small"
            @click="onResetFilter"
          >
            重置
          </BaseButton>
          <BaseButton
            size="small"
            @click="onConfirmFilter"
          >
            确定
          </BaseButton>
        </view>
      </view>
    </view>

    <view
      v-if="mergeSheet"
      class="sheet-mask"
    >
      <view class="sheet-mask-dim" />
      <view
        class="sheet"
        @tap.stop
      >
        <view class="sheet-title">
          检测到本地存在装扮配置，是否合并到账号？
        </view>
        <view class="muted">
          云端装扮配置优先。你可以选择使用云端、使用本地，或合并两者。
        </view>
        <view class="action-stack">
          <BaseButton @click="onMergeChoice('cloud')">
            使用云端配置
          </BaseButton>
          <BaseButton
            variant="ghost"
            @click="onMergeChoice('local')"
          >
            使用本地配置
          </BaseButton>
          <BaseButton
            variant="ghost"
            @click="onMergeChoice('merge')"
          >
            合并两者
          </BaseButton>
        </view>
      </view>
    </view>

    <ThemeShareSheet
      :target="shareTarget"
      :is-mini-program="isMiniProgram"
      @close="shareTarget = null"
    />
  </PageShell>
</template>

<script>
import TSwitch from '@tdesign/uniapp/switch/switch.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import confirmDialog from '@/components/ConfirmDialog';
import PageShell from '@/components/PageShell.vue';
import ThemeLivePreview from '@/components/ThemeLivePreview.vue';
import ThemeShareSheet from '@/components/ThemeShareSheet.vue';
import ThemeStatusPane from '@/components/ThemeStatusPane.vue';
import { isLoggedIn } from '@/services/authGuard';
import { notify, notifySuccess } from '@/services/feedback';
import {
  goThemeAcquire,
  goThemeDress,
  goThemeEvent,
  goThemeMember,
  ROUTES,
} from '@/services/navigation';
import { isWechatMiniProgram } from '@/services/platform';
import {
  getThemePreference,
  setThemePreference,
  THEME_OPTIONS,
} from '@/services/theme';
import { pullThemeCloudState } from '@/services/themeApi';
import {
  trackThemeApply,
  trackThemeApplyInvalid,
  trackThemeApplyMix,
  trackThemeCenterEnter,
  trackThemeCenterLeave,
  trackThemeCollect,
  trackThemeFault,
  trackThemeFilterClick,
  trackThemeGet,
  trackThemeHotSearch,
  trackThemeItemDetail,
  trackThemeListScroll,
  trackThemeMixManage,
  trackThemePreview,
  trackThemeResetAll,
  trackThemeSaveMix,
  trackThemeSearch,
  trackThemeSwitchConflict,
  trackThemeTabSwitch,
  trackThemeUnsupportedEnv,
  trackThemePerfListReady,
} from '@/services/themeAnalytics';
import {
  accessActionLabel,
  accessTagClass,
  applyRecent,
  applySavedOutfit,
  canLivePreview,
  catalogStatus,
  claimSkin,
  cleanSearchKeyword,
  clearLocalDress,
  composePreviewOutfit,
  defaultThemeQuery,
  deleteSavedOutfit,
  describeAccess,
  DIALECT_REGIONS,
  DRESS_CATEGORIES,
  dressDisplayTags,
  FAVORITE_FILTERS,
  getActiveTheme,
  getDressGroup,
  getDressItem,
  getLocalDressMap,
  getOverlayLocalDress,
  getSavedOutfits,
  getThemeById,
  getThemeQuery,
  isFavorited,
  isRemotePreviewSrc,
  listAcquireOffers,
  listDressGroupsByCategory,
  listFavorites,
  listOutfitHubDress,
  listOwnedUnused,
  listRecentUses,
  listThemesByCategory,
  mergeRemoteCatalog,
  persistActiveTheme,
  persistCurrentOutfit,
  persistLocalDress,
  persistThemeQuery,
  previewCoverOf,
  previewDetailOf,
  queryThemeCatalog,
  renameSavedOutfit,
  resetAllDress,
  saveCurrentOutfit,
  searchThemeCatalog,
  setOverlayLocalDress,
  socialStats,
  themeDisplayTags,
  themePreviewVars,
  THEME_ACCESS_FILTERS,
  THEME_ACCESS_FOOTER,
  THEME_CATEGORIES,
  THEME_FEATURE_ITEMS,
  THEME_FILTER_FOOTER,
  THEME_GUEST_FOOTER,
  THEME_HISTORY_FOOTER,
  THEME_HOT_KEYWORDS,
  THEME_PREVIEW_FOOTER,
  THEME_PREVIEW_ZOOM_HINT,
  THEME_SEARCH_TABS,
  THEME_SOCIAL_FOOTER,
  THEME_SORTS,
  THEME_STATUS_FILTERS,
  toggleFavorite,
  toggleLike,
} from '@/services/themeCenter';
import {
  abortThemePreview,
  applyThemeMergeChoice,
  beginThemeApply,
  beginThemePreview,
  bindThemeNetworkFlush,
  guestThemeSnapshot,
  handleThemeAccountLogin,
  isThemeSdkSupported,
  loadThemeCatalog,
  refreshThemeMemberStatus,
  THEME_FAULT_TOAST,
} from '@/services/themeFault';
import { cleanThemeShareQuery, themeSharePayload } from '@/utils/themeShare';

export default {
  components: {
    BaseButton,
    BaseField,
    BaseForm,
    BaseLoading,
    PageShell,
    ThemeLivePreview,
    ThemeShareSheet,
    ThemeStatusPane,
    TSwitch,
  },
  data() {
    return {
      ROUTES,
      tab: 'global',
      category: 'all',
      dialectRegion: 'all',
      dressCategory: 'all',
      themeSort: 'newest',
      accessFilter: 'all',
      statusFilter: 'all',
      regions: [],
      searching: false,
      resultTab: 'all',
      searchForm: { keyword: '' },
      searchResult: { themes: [], dresses: [], all: [] },
      filterSheet: false,
      filterDraft: defaultThemeQuery(),
      favoriteFilter: 'all',
      categories: THEME_CATEGORIES,
      dialectRegions: DIALECT_REGIONS,
      dressCategories: DRESS_CATEGORIES,
      sortOptions: THEME_SORTS,
      accessFilters: THEME_ACCESS_FILTERS,
      statusFilters: THEME_STATUS_FILTERS,
      searchTabs: THEME_SEARCH_TABS,
      hotKeywords: THEME_HOT_KEYWORDS,
      favoriteFilters: FAVORITE_FILTERS,
      themeFeatures: THEME_FEATURE_ITEMS,
      appearanceOptions: THEME_OPTIONS,
      appearance: getThemePreference(),
      isMiniProgram: isWechatMiniProgram(),
      activeTheme: getActiveTheme(),
      overlay: getOverlayLocalDress(),
      appliedDress: [],
      ownedUnused: { themes: [], dresses: [] },
      acquireOffers: { themes: [], dresses: [] },
      favoriteEntries: [],
      accessFooter: THEME_ACCESS_FOOTER,
      socialFooter: THEME_SOCIAL_FOOTER,
      historyFooter: THEME_HISTORY_FOOTER,
      filterFooter: THEME_FILTER_FOOTER,
      previewFooter: THEME_PREVIEW_FOOTER,
      zoomHint: THEME_PREVIEW_ZOOM_HINT,
      socialTick: 0,
      detailTheme: null,
      shareTarget: null,
      previewOpen: false,
      zoomOpen: false,
      coverFailed: {},
      previewMode: 'outfit',
      previewItem: null,
      previewOutfit: null,
      previewModel: null,
      scrollTimer: 0,
      recentThemes: [],
      recentDresses: [],
      savedOutfits: [],
      outfitSheet: false,
      outfitMode: 'save',
      outfitTargetId: '',
      outfitForm: { name: '' },
      outfitError: '',
      outfitRules: {
        name: [{ required: true, message: '请输入搭配名称' }],
      },
      catalogFail: false,
      catalogLoading: false,
      catalogStale: false,
      memberSyncing: false,
      sdkSupported: true,
      mergeSheet: false,
      mergeSnapshot: null,
    };
  },
  computed: {
    recentRows() {
      return this.tab === 'local' ? this.recentDresses : this.recentThemes;
    },
    navInterceptBack() {
      return this.searching || this.tab === 'mine';
    },
    showFilterBar() {
      return this.searching || this.tab === 'global' || this.tab === 'local';
    },
    hasExtraFilters() {
      return this.accessFilter !== 'all'
        || this.statusFilter !== 'all'
        || this.regions.length > 0;
    },
    showDressItems() {
      return this.hasExtraFilters;
    },
    themeListEmptyScene() {
      return this.hasExtraFilters ? 'filter' : 'catalog';
    },
    filterSummary() {
      const bits = [];
      if (this.accessFilter !== 'all') {
        bits.push(this.accessFilters.find((item) => item.value === this.accessFilter)?.label);
      }
      if (this.statusFilter !== 'all') {
        bits.push(this.statusFilters.find((item) => item.value === this.statusFilter)?.label);
      }
      if (this.regions.length) {
        bits.push(this.regions.map((value) => (
          this.dialectRegions.find((item) => item.value === value)?.label
        )).filter(Boolean).join('、'));
      }
      bits.push(this.sortOptions.find((item) => item.value === this.themeSort)?.label || '最新上架');
      return bits.filter(Boolean).join(' · ');
    },
    catalogQuery() {
      return {
        keyword: this.searching ? this.searchForm.keyword : '',
        access: this.accessFilter,
        category: this.category,
        dressCategory: this.dressCategory,
        regions: this.regions,
        status: this.statusFilter,
        sort: this.themeSort,
      };
    },
    visibleThemes() {
      return queryThemeCatalog({
        ...this.catalogQuery,
        dressCategory: 'all',
        keyword: '',
      }, { isMiniProgram: this.isMiniProgram }).themes.map((row) => row.item);
    },
    visibleDressItems() {
      return queryThemeCatalog({
        ...this.catalogQuery,
        category: 'all',
        keyword: '',
      }, { isMiniProgram: this.isMiniProgram }).dresses;
    },
    searchRows() {
      if (this.resultTab === 'theme') return this.searchResult.themes;
      if (this.resultTab === 'dress') return this.searchResult.dresses;
      return this.searchResult.all;
    },
    dressGroups() {
      return listDressGroupsByCategory(this.dressCategory, {
        isMiniProgram: this.isMiniProgram,
      }).map((group) => ({
        ...group,
        blocked: group.mpBlocked && this.isMiniProgram,
      }));
    },
    enableConfirmCopy() {
      if (this.overlay) {
        return '确认后立即套用整套配色。已开启覆盖，局部装扮暂时不会生效，配置仍保留。小程序里原生导航栏和底栏无法完全自定义。';
      }
      return '确认后立即套用整套配色，已装扮的部件会优先显示。小程序里原生导航栏和底栏无法完全自定义。';
    },
    hasAppliedDress() {
      return this.appliedDress.some((entry) => Boolean(entry.item));
    },
    previewShotClass() {
      const classes = [`shot-${this.activeTheme.preview}`];
      this.appliedDress.forEach((entry) => {
        if (entry.effective) classes.push(`dress-${entry.group.id}`);
      });
      return classes;
    },
    previewTitle() {
      return this.previewMode === 'outfit' || this.previewMode === 'mix'
        ? '装扮效果预览'
        : '实时预览';
    },
    livePreviewModel() {
      return this.previewModel || composePreviewOutfit({
        isMiniProgram: this.isMiniProgram,
      });
    },
    accountSyncNote() {
      if (!isLoggedIn()) return THEME_GUEST_FOOTER[0].replace(/^提示：/, '');
      return '装扮配置登录账号后会同步至云端，更换设备可继承。';
    },
  },
  async onLoad(options) {
    bindThemeNetworkFlush();
    this.sdkSupported = isThemeSdkSupported();
    if (!this.sdkSupported) {
      await confirmDialog({
        title: '需要更新小程序',
        content: THEME_FAULT_TOAST.sdk,
        confirmText: '知道了',
        cancelText: '关闭',
      });
    }
    await this.bootThemeCenter();
    this.applySavedQuery(getThemeQuery());
    if (options?.tab === 'global') this.tab = 'global';
    if (options?.tab === 'local') this.tab = 'local';
    if (options?.tab === 'mine') this.tab = 'mine';
    if (options?.tab === 'favorites') this.tab = 'favorites';
    const routeKeyword = String(options?.q || options?.keyword || '').trim();
    if (routeKeyword) this.searchForm.keyword = routeKeyword;
    const wantSearch = options?.searching === '1'
      || options?.searching === 1
      || options?.searching === true;
    this.refreshOutfit();
    if (wantSearch) {
      if (this.searchForm.keyword) this.runSearch({ toast: false });
      else this.searching = true;
    } else if (this.searching && this.searchForm.keyword) {
      this.runSearch({ toast: false });
    }
    if (options?.kind === 'theme' && options?.id) {
      const shareId = cleanThemeShareQuery(options.id);
      const match = shareId && (
        this.visibleThemes.find((item) => item.id === shareId)
        || listThemesByCategory('all', 'all', 'newest').find((item) => item.id === shareId)
      );
      if (match) this.openDetail(match);
    }
  },
  async onShow() {
    await this.syncAccountAndMember();
    this.refreshOutfit();
    this.reportThemeCenterEnter();
  },
  onHide() {
    trackThemeCenterLeave();
  },
  watch: {
    favoriteFilter() {
      this.favoriteEntries = listFavorites(this.favoriteFilter);
    },
  },
  onShareAppMessage() {
    if (this.shareTarget?.item?.available) {
      return themeSharePayload(this.shareTarget.kind, this.shareTarget.item);
    }
    return themeSharePayload('theme', this.activeTheme);
  },
  methods: {
    themePreviewVars,
    outfitPreviewVars(outfit) {
      return themePreviewVars(getThemeById(outfit?.themeId));
    },
    async bootThemeCenter() {
      await this.retryCatalog();
      await this.syncAccountAndMember();
    },
    async retryCatalog() {
      this.catalogLoading = true;
      const started = Date.now();
      try {
        const catalog = await loadThemeCatalog();
        this.catalogStale = Boolean(catalog.stale);
        this.catalogFail = !catalog.ok && !catalog.stale;
        if (catalog.ok && catalog.data) {
          mergeRemoteCatalog(catalog.data);
        }
        if (this.catalogStale) {
          notify({ title: THEME_FAULT_TOAST.catalogCache });
        }
        trackThemePerfListReady({
          readyMs: Date.now() - started,
          fromCache: catalog.source === 'cache' || catalog.stale,
          itemCount: (catalog.data?.themes?.length || 0) + (catalog.data?.dresses?.length || 0),
        });
      } finally {
        this.catalogLoading = false;
      }
    },
    async syncAccountAndMember() {
      if (isLoggedIn()) {
        this.memberSyncing = true;
        await refreshThemeMemberStatus();
        this.memberSyncing = false;
        const login = await handleThemeAccountLogin(uni.getStorageSync('id'));
        if (login.merge && !this.mergeSheet) {
          this.mergeSnapshot = login.merge;
          this.mergeSheet = true;
        } else if (login.switched) {
          try {
            await pullThemeCloudState();
            this.refreshOutfit();
          } catch {
            // Keep the local default pack until the next successful pull.
          }
        }
        return;
      }
      this.memberSyncing = false;
      if (guestThemeSnapshot() && !this.mergeSheet) {
        this.mergeSnapshot = guestThemeSnapshot();
      }
    },
    async onMergeChoice(choice) {
      const snapshot = this.mergeSnapshot;
      this.mergeSheet = false;
      this.mergeSnapshot = null;
      await applyThemeMergeChoice(choice, snapshot);
      this.refreshOutfit();
    },
    catalogBadge(item) {
      const info = describeAccess(item, item?.group ? 'dress' : 'theme', {
        group: item?.group ? getDressGroup(item.group) : null,
        isMiniProgram: this.isMiniProgram,
      });
      if (info.action === 'removed') return '装扮已下架';
      if (info.action === 'broken') return '装扮资源加载异常';
      if (info.action === 'ended') return '已绝版';
      if (!item?.available) return '敬请期待';
      if (info.action === 'mp-block') return '拥有权限，但小程序环境暂不支持该装扮';
      return '';
    },
    guardApply(key = 'apply') {
      return beginThemeApply(key).ok;
    },
    notifyPersist(result, { social = false } = {}) {
      if (!result) return;
      if (result.reason === 'rate') {
        notify({ title: THEME_FAULT_TOAST.rate });
        trackThemeFault('rate');
        return;
      }
      if (result.reason === 'quota' || result.persisted === false) {
        notify({ title: THEME_FAULT_TOAST.quota });
        return;
      }
      if (result.reason === 'style') {
        notify({ title: THEME_FAULT_TOAST.style });
        return;
      }
      if (result.reason === 'resource' || result.reason === 'removed') {
        notify({ title: THEME_FAULT_TOAST.resource });
      }
      if (social && result.syncFailed) {
        notify({ title: THEME_FAULT_TOAST.socialSyncFail });
      }
    },
    refreshOutfit() {
      this.activeTheme = getActiveTheme();
      this.overlay = getOverlayLocalDress();
      this.appliedDress = listOutfitHubDress({ isMiniProgram: this.isMiniProgram });
      this.ownedUnused = listOwnedUnused({ isMiniProgram: this.isMiniProgram });
      this.acquireOffers = listAcquireOffers();
      this.favoriteEntries = listFavorites(this.favoriteFilter);
      this.recentThemes = listRecentUses({
        isMiniProgram: this.isMiniProgram,
        kind: 'theme',
      });
      this.recentDresses = listRecentUses({
        isMiniProgram: this.isMiniProgram,
        kind: 'dress',
      });
      this.savedOutfits = getSavedOutfits();
      this.socialTick += 1;
    },
    statsOf(kind, item) {
      return socialStats(kind, item, this.socialTick);
    },
    browseItemIds() {
      if (this.searching) {
        return this.searchRows.map((row) => row.item.id);
      }
      if (this.tab === 'local') {
        return this.visibleDressItems.map((row) => row.item.id);
      }
      if (this.tab === 'favorites') {
        return this.favoriteEntries.map((row) => row.item.id);
      }
      if (this.tab === 'global') {
        return this.visibleThemes.map((item) => item.id);
      }
      return [];
    },
    onTabSwitch(tab) {
      if (this.tab === tab) return;
      this.tab = tab;
      trackThemeTabSwitch(tab);
    },
    reportThemeCenterEnter() {
      trackThemeCenterEnter({ themeId: this.activeTheme.id });
    },
    reportThemeListScroll(scrollTop = 0) {
      trackThemeListScroll({
        itemIds: this.browseItemIds(),
        scrollTop,
        query: this.catalogQuery,
      });
    },
    onShellScroll(event) {
      const top = event?.scrollTop || 0;
      if (this.scrollTimer) clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        this.reportThemeListScroll(top);
      }, 400);
    },
    isItemFav(kind, id) {
      return this.socialTick >= 0 && isFavorited(kind, id);
    },
    async onToggleFavorite(kind, item) {
      if (!this.guardApply(`fav:${kind}:${item?.id}`)) return;
      const already = isFavorited(kind, item?.id);
      if (!item?.available && !already) {
        notify({ title: '待上线装扮暂不支持收藏' });
        return;
      }
      const result = await Promise.resolve(toggleFavorite(kind, item));
      if (!result?.ok) {
        if (result?.reason === 'upcoming') {
          notify({ title: '待上线装扮暂不支持收藏' });
        } else if (result?.reason === 'rate') {
          notify({ title: THEME_FAULT_TOAST.rate });
        }
        return;
      }
      this.refreshOutfit();
      trackThemeCollect(kind, item, result.favorited);
      if (result.queued) {
        notify({ title: THEME_FAULT_TOAST.socialSyncFail });
        return;
      }
      let title = '已取消收藏';
      if (result.favorited) {
        title = kind === 'theme' ? '已收藏该主题' : '已收藏该装扮';
      }
      notifySuccess(title);
    },
    onToggleLike(kind, item) {
      if (!item?.available) return;
      toggleLike(kind, item);
      this.refreshOutfit();
    },
    onShare(kind, item) {
      if (!this.guardApply(`share:${kind}:${item?.id}`)) return;
      if (!item?.available) {
        notify({ title: '待上线装扮暂不支持分享' });
        return;
      }
      this.shareTarget = { kind, item };
    },
    onOpenFavorite(entry) {
      if (entry.kind === 'theme') {
        this.openDetail(entry.item);
        return;
      }
      goThemeDress(entry.item.group, { id: entry.item.id });
    },
    onFavoriteEnable(entry) {
      if (entry.kind === 'theme') {
        this.onCardEnable(entry.item);
        return;
      }
      this.onDressOffer(entry.item);
    },
    favoriteActionLabel(entry) {
      if (entry.kind === 'theme') return this.themeActionLabel(entry.item);
      return accessActionLabel(this.dressAccess(entry.item), { kind: 'dress' });
    },
    favoriteVariant(entry) {
      if (entry.kind === 'theme') return this.themeActionVariant(entry.item);
      return this.dressActionVariant(entry.item);
    },
    favoriteDisabled(entry) {
      if (entry.kind === 'theme') return this.themeActionDisabled(entry.item);
      return this.dressActionDisabled(entry.item);
    },
    themeAccess(theme) {
      return describeAccess(theme, 'theme', { isMiniProgram: this.isMiniProgram });
    },
    dressAccess(item, group) {
      return describeAccess(item, 'dress', {
        group: group || getDressGroup(item.group),
        isMiniProgram: this.isMiniProgram,
      });
    },
    tagClass(item) {
      return accessTagClass(item);
    },
    themeTags(theme) {
      return themeDisplayTags(theme, {
        applied: theme?.id === this.activeTheme.id,
      });
    },
    isGreyTheme(theme) {
      const info = this.themeAccess(theme);
      return !theme.available
        || info.action === 'ended'
        || info.action === 'removed'
        || info.action === 'broken';
    },
    themeActionLabel(theme) {
      return accessActionLabel(this.themeAccess(theme), {
        applied: theme.id === this.activeTheme.id,
        kind: 'theme',
      });
    },
    themeActionDisabled(theme) {
      const info = this.themeAccess(theme);
      if (!this.sdkSupported) return true;
      if (theme.id === this.activeTheme.id) return true;
      return info.disabled
        || info.action === 'soon'
        || info.action === 'ended'
        || info.action === 'removed'
        || info.action === 'broken'
        || info.action === 'mp-block';
    },
    themeActionVariant(theme) {
      if (this.themeActionDisabled(theme)) return 'ghost';
      return 'primary';
    },
    dressActionDisabled(item) {
      const info = this.dressAccess(item);
      if (!this.sdkSupported) return true;
      return info.disabled
        || info.action === 'soon'
        || info.action === 'ended'
        || info.action === 'removed'
        || info.action === 'broken'
        || info.action === 'mp-block';
    },
    dressActionVariant(item) {
      if (this.dressActionDisabled(item)) return 'ghost';
      return 'primary';
    },
    onAppearance(preference) {
      const next = setThemePreference(preference);
      this.appearance = next.preference;
    },
    onSearch() {
      this.submitThemeSearch();
    },
    onThemeNavBack() {
      if (this.searching) {
        this.exitSearch();
        return;
      }
      if (this.tab === 'mine') this.onTabSwitch('global');
    },
    applySavedQuery(query) {
      const next = { ...defaultThemeQuery(), ...query };
      this.category = next.category;
      this.dressCategory = next.dressCategory;
      this.themeSort = next.sort;
      this.accessFilter = next.access;
      this.statusFilter = next.status;
      this.regions = [...(next.regions || [])];
      this.dialectRegion = this.regions[0] || 'all';
      this.searchForm = { keyword: next.keyword || '' };
      this.resultTab = next.resultTab || 'all';
      this.searching = Boolean(next.searching && next.keyword);
    },
    persistBrowseQuery() {
      persistThemeQuery({
        ...this.catalogQuery,
        keyword: this.searchForm.keyword,
        resultTab: this.resultTab,
        searching: this.searching,
      });
    },
    runSearch({ toast = true } = {}) {
      const result = searchThemeCatalog(
        this.searchForm.keyword,
        this.catalogQuery,
        { isMiniProgram: this.isMiniProgram },
      );
      this.searchResult = result;
      this.searching = true;
      if (toast && !result.all.length) {
        notify({ title: '没有匹配的主题装扮，请更换关键词' });
      }
    },
    submitThemeSearch() {
      const keyword = cleanSearchKeyword(this.searchForm.keyword);
      this.searchForm.keyword = keyword;
      if (!keyword) {
        this.searching = false;
        this.persistBrowseQuery();
        return;
      }
      this.runSearch({ toast: true });
      trackThemeSearch(keyword, this.searchResult.all.length);
    },
    onHotKeyword(tag) {
      trackThemeHotSearch(tag);
      this.searchForm.keyword = tag;
      this.submitThemeSearch();
    },
    onResultTab(value) {
      this.resultTab = value;
      this.persistBrowseQuery();
    },
    exitSearch() {
      this.searching = false;
      this.persistBrowseQuery();
    },
    openFilterSheet() {
      this.filterDraft = {
        ...defaultThemeQuery(),
        ...this.catalogQuery,
        keyword: this.searchForm.keyword,
        resultTab: this.resultTab,
        searching: this.searching,
        regions: [...this.regions],
      };
      this.filterSheet = true;
    },
    closeFilterSheet() {
      this.filterSheet = false;
    },
    isDraftRegionOn(value) {
      if (value === 'all') return !this.filterDraft.regions.length;
      return this.filterDraft.regions.includes(value);
    },
    isRegionChipOn(value) {
      if (value === 'all') return !this.regions.length;
      return this.regions.includes(value);
    },
    onToggleDraftRegion(value) {
      if (value === 'all') {
        this.filterDraft.regions = [];
        return;
      }
      const current = this.filterDraft.regions.filter((item) => item !== 'all');
      this.filterDraft.regions = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
    },
    onResetFilter() {
      this.filterDraft = {
        ...defaultThemeQuery(),
        keyword: this.searchForm.keyword,
        searching: this.searching,
        resultTab: this.resultTab,
      };
    },
    onClearAppliedFilters() {
      const next = defaultThemeQuery();
      this.accessFilter = next.access;
      this.statusFilter = next.status;
      this.category = next.category;
      this.dressCategory = next.dressCategory;
      this.themeSort = next.sort;
      this.regions = [];
      this.dialectRegion = 'all';
      this.filterDraft = {
        ...next,
        keyword: this.searchForm.keyword,
        searching: this.searching,
        resultTab: this.resultTab,
      };
      this.persistBrowseQuery();
    },
    onThemeListEmptyAction() {
      if (this.themeListEmptyScene === 'filter') this.onClearAppliedFilters();
    },
    onFavoriteEmptyAction() {
      this.onTabSwitch('global');
    },
    onDressAppliedEmptyAction() {
      this.onTabSwitch('local');
    },
    onConfirmFilter() {
      this.accessFilter = this.filterDraft.access;
      this.statusFilter = this.filterDraft.status;
      this.category = this.filterDraft.category;
      this.dressCategory = this.filterDraft.dressCategory;
      this.themeSort = this.filterDraft.sort;
      this.regions = [...(this.filterDraft.regions || [])];
      this.dialectRegion = this.regions[0] || 'all';
      this.filterSheet = false;
      this.persistBrowseQuery();
      trackThemeFilterClick(this.catalogQuery);
      if (this.searching) {
        this.runSearch({ toast: true });
        return;
      }
      const empty = this.tab === 'local'
        ? this.hasExtraFilters && !this.visibleDressItems.length
        : !this.visibleThemes.length && this.hasExtraFilters;
      if (empty) {
        notify({ title: '当前筛选条件下暂无可用装扮' });
      }
    },
    onThemeRegion(value) {
      this.dialectRegion = value;
      this.regions = !value || value === 'all' ? [] : [value];
      this.persistBrowseQuery();
    },
    onThemeSort(value) {
      this.themeSort = value;
      this.persistBrowseQuery();
    },
    onDressCategory(value) {
      this.dressCategory = value;
      this.persistBrowseQuery();
    },
    isGreyEntry(entry) {
      if (entry?.blocked) return true;
      const item = entry?.item;
      if (!item) return true;
      return this.isGreyTheme(item) || Boolean(this.catalogBadge(item));
    },
    searchActionLabel(entry) {
      if (entry.kind === 'theme') return this.themeActionLabel(entry.item);
      return accessActionLabel(this.dressAccess(entry.item, entry.group), { kind: 'dress' });
    },
    searchActionDisabled(entry) {
      if (entry.blocked) return true;
      if (entry.kind === 'theme') return this.themeActionDisabled(entry.item);
      return this.dressActionDisabled(entry.item);
    },
    searchActionVariant(entry) {
      if (this.searchActionDisabled(entry)) return 'ghost';
      return 'primary';
    },
    onOpenSearchEntry(entry) {
      if (entry.kind === 'theme') {
        this.openDetail(entry.item);
        return;
      }
      if (entry.blocked) {
        trackThemeUnsupportedEnv('dress', entry.item);
        notify({ title: '当前小程序环境暂不支持该装扮' });
        return;
      }
      goThemeDress(entry.item.group, { id: entry.item.id });
    },
    onSearchEnable(entry) {
      this.onFavoriteEnable(entry);
    },
    onAcquire() {
      goThemeAcquire();
    },
    onThemeCategory(value) {
      this.category = value;
      if (value !== 'dialect') this.dialectRegion = 'all';
      this.persistBrowseQuery();
    },
    openDetail(theme) {
      this.detailTheme = theme;
      this.zoomOpen = false;
      trackThemeItemDetail('theme', theme);
      trackThemePreview('theme', theme, 'detail');
    },
    closeDetail() {
      this.zoomOpen = false;
      this.detailTheme = null;
    },
    themeCoverSrc(item) {
      const src = previewCoverOf(item);
      if (!item?.id || !isRemotePreviewSrc(src) || this.coverFailed[item.id]) return '';
      return src;
    },
    themeDetailSrc(item) {
      const src = previewDetailOf(item);
      const key = `detail:${item?.id}`;
      if (!item?.id || !isRemotePreviewSrc(src) || this.coverFailed[key]) return '';
      return src;
    },
    onPreviewImgError(key) {
      if (this.coverFailed[key]) return;
      const firstFail = !Object.keys(this.coverFailed).length;
      this.coverFailed = { ...this.coverFailed, [key]: true };
      if (firstFail) notify({ title: THEME_FAULT_TOAST.resource });
    },
    openZoom() {
      if (!this.detailTheme) return;
      if (!this.guardApply('preview-zoom')) return;
      this.zoomOpen = true;
    },
    closeZoom() {
      this.zoomOpen = false;
    },
    async onCardEnable(theme) {
      const info = this.themeAccess(theme);
      if (info.action === 'removed') {
        notify({ title: '装扮已下架' });
        return;
      }
      if (info.action === 'broken') {
        notify({ title: THEME_FAULT_TOAST.resource });
        return;
      }
      if (!this.sdkSupported) {
        notify({ title: THEME_FAULT_TOAST.sdk });
        return;
      }
      if (info.action === 'soon') {
        trackThemeApplyInvalid('theme', theme, '已下架');
        notify({ title: '该主题暂未开放，敬请期待' });
        return;
      }
      if (info.action === 'ended') {
        trackThemeApplyInvalid('theme', theme, '已绝版');
        notify({ title: '该限定装扮活动已结束，无法获取' });
        return;
      }
      if (info.action === 'member') {
        trackThemeApply({
          kind: 'theme',
          item: theme,
          result: 'no_permission',
          permission: 'member',
        });
        await this.openMemberGate('theme', theme);
        return;
      }
      if (info.action === 'event') {
        trackThemeApply({
          kind: 'theme',
          item: theme,
          result: 'no_permission',
          permission: 'event',
        });
        trackThemeGet('theme', theme, 'event');
        goThemeEvent({ id: theme.id, kind: 'theme' });
        return;
      }
      if (info.action === 'creator-lock') {
        trackThemeApply({
          kind: 'theme',
          item: theme,
          result: 'no_permission',
          permission: 'creator',
        });
        trackThemeGet('theme', theme, 'creator');
        notify({ title: '暂未满足解锁条件，请完成方言创作任务' });
        goThemeAcquire({ focus: 'creator' });
        return;
      }
      if (info.action === 'claim') {
        const claimed = await Promise.resolve(claimSkin('theme', theme.id));
        if (!claimed?.ok) {
          notify({ title: '暂无权限使用该装扮' });
          return;
        }
        trackThemeGet('theme', theme, theme.access);
        this.refreshOutfit();
        notifySuccess('恭喜，已获得该装扮，可前往我的装扮使用');
        return;
      }
      if (theme.id === this.activeTheme.id) return;
      const confirmed = await confirmDialog({
        title: '启用这套主题？',
        content: this.enableConfirmCopy,
        confirmText: '立即启用',
      });
      if (!confirmed) return;
      if (!this.guardApply(`theme:${theme.id}`)) return;
      const result = await persistActiveTheme(theme.id);
      if (!result.ok) {
        this.notifyPersist(result);
        if (!['quota', 'style', 'resource', 'removed'].includes(result.reason)) {
          notify({ title: this.persistFailTitle(result.reason) });
        }
        return;
      }
      this.notifyPersist(result);
      if (result.reason === 'rate') {
        this.refreshOutfit();
        this.closeDetail();
        return;
      }
      trackThemeApply({ kind: 'theme', item: theme, result: 'success' });
      this.refreshOutfit();
      this.closeDetail();
      notifySuccess('全局主题已应用');
    },
    persistFailTitle(reason) {
      if (reason === 'upcoming') return '该主题暂未开放，敬请期待';
      if (reason === 'member') return '该装扮为会员专属，请先开通会员';
      if (reason === 'event') return '该限定装扮活动已结束，无法获取';
      if (reason === 'ended') return '该限定装扮活动已结束，无法获取';
      if (reason === 'creator') return '暂未满足解锁条件，请完成方言创作任务';
      if (reason === 'privilege') return '暂无权限使用该装扮';
      if (reason === 'terminal') return '当前环境暂不支持该装扮';
      if (reason === 'rate') return THEME_FAULT_TOAST.rate;
      if (reason === 'quota') return THEME_FAULT_TOAST.quota;
      if (reason === 'style') return THEME_FAULT_TOAST.style;
      if (reason === 'resource' || reason === 'removed') return THEME_FAULT_TOAST.resource;
      if (reason === 'busy') return '';
      return '该主题暂未开放，敬请期待';
    },
    async openMemberGate(kind, item) {
      const go = await confirmDialog({
        title: '开通会员',
        content: '该装扮为会员专属，开通会员即可解锁全部会员主题与装扮。开通后可解锁全部会员全局主题、会员局部装扮。',
        confirmText: '开通会员',
        cancelText: '取消',
      });
      if (go) {
        trackThemeGet(kind, item, 'member');
        goThemeMember();
      }
    },
    async onDressOffer(item) {
      const info = this.dressAccess(item);
      if (info.action === 'removed') {
        notify({ title: '装扮已下架' });
        return;
      }
      if (info.action === 'broken') {
        notify({ title: THEME_FAULT_TOAST.resource });
        return;
      }
      if (info.action === 'ended') {
        trackThemeApplyInvalid('dress', item, '已绝版');
        notify({ title: '该限定装扮活动已结束，无法获取' });
        return;
      }
      if (info.action === 'member') {
        trackThemeApply({
          kind: 'dress',
          item,
          result: 'no_permission',
          permission: 'member',
        });
        await this.openMemberGate('dress', item);
        return;
      }
      if (info.action === 'event') {
        trackThemeApply({
          kind: 'dress',
          item,
          result: 'no_permission',
          permission: 'event',
        });
        trackThemeGet('dress', item, 'event');
        goThemeEvent({ id: item.id, kind: 'dress' });
        return;
      }
      if (info.action === 'creator-lock') {
        trackThemeApply({
          kind: 'dress',
          item,
          result: 'no_permission',
          permission: 'creator',
        });
        trackThemeGet('dress', item, 'creator');
        notify({ title: '暂未满足解锁条件，请完成方言创作任务' });
        goThemeAcquire({ focus: 'creator' });
        return;
      }
      if (info.action === 'claim') {
        const claimed = await Promise.resolve(claimSkin('dress', item.id));
        if (!claimed?.ok) {
          notify({ title: '暂无权限使用该装扮' });
          return;
        }
        trackThemeGet('dress', item, item.access);
        this.refreshOutfit();
        notifySuccess('恭喜，已获得该装扮，可前往我的装扮使用');
        return;
      }
      goThemeDress(item.group);
    },
    async onApplyOwnedDress(entry) {
      if (entry.blocked) {
        trackThemeUnsupportedEnv('dress', entry.item);
        trackThemeApply({
          kind: 'dress',
          item: entry.item,
          result: 'unsupported_env',
        });
        notify({ title: '拥有权限，但小程序环境暂不支持该装扮' });
        return;
      }
      if (!this.guardApply(`dress:${entry.item.id}`)) return;
      const result = await persistLocalDress(entry.group.id, entry.item.id);
      if (!result.ok) {
        this.notifyPersist(result);
        notify({ title: result.reason === 'upcoming' ? '装扮素材即将上线' : this.persistFailTitle(result.reason) });
        return;
      }
      this.notifyPersist(result);
      if (result.reason === 'rate') {
        this.refreshOutfit();
        return;
      }
      trackThemeApply({ kind: 'dress', item: entry.item, result: 'success' });
      this.refreshOutfit();
      notifySuccess('装扮已生效');
    },
    onOpenDress(group) {
      if (group.blocked) {
        trackThemeUnsupportedEnv('dress', { id: group.id, group: group.id });
        notify({ title: '当前小程序环境暂不支持该装扮' });
        return;
      }
      goThemeDress(group.id);
    },
    onEditDress(group, entry) {
      if (entry?.blocked) {
        notify({ title: '当前小程序环境暂不支持该装扮' });
        return;
      }
      goThemeDress(group.id);
    },
    onClearDress(entry) {
      if (!entry?.item) return;
      const result = clearLocalDress(entry.group.id);
      this.notifyPersist(result);
      this.refreshOutfit();
      notifySuccess('已恢复跟随全局主题');
    },
    onChangeTheme() {
      this.onTabSwitch('global');
    },
    recentTagClass(row) {
      if (row?.status === 'ended') return 'tag-ended';
      if (row?.status === 'blocked') return 'tag-soon';
      if (row?.status === 'retired') return 'tag-soon';
      if (row?.status === 'gated') return accessTagClass(row.item);
      return 'tag-free';
    },
    onRecentTap(row) {
      if (row.status === 'blocked') {
        trackThemeUnsupportedEnv(row.kind, { id: row.id });
        notify({ title: row.hint || '当前环境暂不支持该装扮' });
        return;
      }
      if (row.kind === 'theme') {
        const theme = getThemeById(row.id);
        if (!theme) {
          notify({ title: row.hint || '装扮已下架' });
          return;
        }
        this.openDetail(theme);
        return;
      }
      const item = getDressItem(row.id);
      if (!item) {
        notify({ title: row.hint || '装扮已下架' });
        return;
      }
      goThemeDress(item.group, { id: item.id });
    },
    async onApplyRecent(row) {
      if (row.disabled) {
        if (row.status === 'ended') {
          trackThemeApplyInvalid(row.kind, { id: row.id }, '已绝版');
        } else if (row.status === 'blocked') {
          trackThemeUnsupportedEnv(row.kind, { id: row.id });
        } else if (row.status === 'gated') {
          trackThemeApply({
            kind: row.kind,
            item: {
              id: row.id,
              access: row.access,
              region: row.region,
              group: row.group,
            },
            fromHistory: true,
            result: 'no_permission',
            permission: row.access,
          });
        }
        notify({ title: row.hint || '当前暂无使用权限' });
        return;
      }
      if (!this.guardApply(`recent:${row.kind}:${row.id}`)) return;
      const result = await applyRecent(row, { isMiniProgram: this.isMiniProgram });
      if (!result.ok) {
        notify({ title: result.hint || '装扮已下架' });
        return;
      }
      trackThemeApply({
        kind: row.kind,
        item: {
          id: row.id,
          access: row.access,
          region: row.region,
          group: row.group,
        },
        fromHistory: true,
        result: 'success',
      });
      this.refreshOutfit();
      notifySuccess(row.kind === 'theme' ? '全局主题已应用' : '装扮已生效');
    },
    outfitSummary(outfit) {
      const theme = getThemeById(outfit.themeId);
      const count = Object.keys(outfit.localDress || {}).length;
      const themeName = theme?.name || '默认方言主题';
      return `${themeName} · ${count} 件局部装扮`;
    },
    onOpenSaveOutfit() {
      this.outfitMode = 'save';
      this.outfitTargetId = '';
      this.outfitForm = { name: '' };
      this.outfitError = '';
      this.outfitSheet = true;
    },
    onOpenRenameOutfit(outfit) {
      this.outfitMode = 'rename';
      this.outfitTargetId = outfit.id;
      this.outfitForm = { name: outfit.name };
      this.outfitError = '';
      this.outfitSheet = true;
    },
    closeOutfitSheet() {
      this.outfitSheet = false;
      this.outfitError = '';
    },
    async onConfirmOutfitSheet() {
      const name = String(this.outfitForm.name || '').trim();
      if (!name) {
        this.outfitError = '请输入搭配名称';
        return;
      }
      if (!this.guardApply(`outfit-save:${this.outfitMode}`)) return;
      this.outfitError = '';
      if (this.outfitMode === 'rename') {
        renameSavedOutfit(this.outfitTargetId, name);
        trackThemeMixManage('rename', this.outfitTargetId);
        this.closeOutfitSheet();
        this.refreshOutfit();
        notifySuccess('已保存这套装扮搭配');
        return;
      }
      const result = saveCurrentOutfit(name);
      if (!result.ok && result.reason === 'limit') {
        await confirmDialog({
          title: '无法保存',
          content: '已达到最大保存数量，请删除旧搭配方案后再保存',
          confirmText: '知道了',
          cancelText: '关闭',
        });
        trackThemeFault('mix_cap');
        return;
      }
      if (!result.ok && result.reason === 'duplicate') {
        notify({ title: THEME_FAULT_TOAST.mixDuplicate });
        return;
      }
      if (!result.ok) {
        this.notifyPersist(result);
        return;
      }
      trackThemeSaveMix(result.outfit);
      this.closeOutfitSheet();
      this.refreshOutfit();
      notifySuccess('已保存这套装扮搭配');
    },
    async onApplyOutfit(outfit) {
      const confirmed = await confirmDialog({
        title: '是否一键应用这套历史搭配？',
        content: '注意：将会覆盖当前全局主题与局部装扮配置。',
        confirmText: '立即应用',
      });
      if (!confirmed) return;
      if (!this.guardApply(`outfit:${outfit.id || outfit.name || 'mix'}`)) return;
      const result = applySavedOutfit(outfit, { isMiniProgram: this.isMiniProgram });
      if (!result.ok) {
        notify({ title: THEME_FAULT_TOAST.mixBroken });
        return;
      }
      trackThemeApplyMix(outfit, { hasUnavailable: Boolean(result.skipped) });
      trackThemeApply({
        kind: 'theme',
        item: getThemeById(outfit.themeId),
        fromHistory: true,
        isMix: true,
        result: 'success',
      });
      this.refreshOutfit();
      this.notifyApplyMix(result);
    },
    notifyApplyMix(result) {
      notifySuccess('已应用历史搭配方案');
      if (result.empty) {
        notify({ title: THEME_FAULT_TOAST.mixEmpty });
        return;
      }
      if (result.skipped) {
        notify({ title: THEME_FAULT_TOAST.skippedRemoved });
      }
    },
    async onDeleteOutfit(outfit) {
      const confirmed = await confirmDialog({
        title: '删除这套搭配方案？',
        content: '删除后无法恢复。',
        danger: true,
        confirmText: '删除',
      });
      if (!confirmed) return;
      if (!this.guardApply(`outfit-delete:${outfit.id || 'mix'}`)) return;
      deleteSavedOutfit(outfit.id);
      trackThemeMixManage('delete', outfit.id);
      this.refreshOutfit();
    },
    dressTags(entry) {
      if (!entry?.item) return [];
      return dressDisplayTags(entry.item, entry.group, { applied: true });
    },
    dressStatus(entry) {
      if (entry.empty || !entry.item) return '暂未设置该组件装扮';
      if (entry.blocked) return '当前环境不生效';
      const status = catalogStatus(entry.item);
      if (status === 'removed') return '已下架';
      if (status === 'ended') return '已绝版';
      if (entry.suppressed) return '已被全局主题覆盖';
      return '当前生效';
    },
    outfitThemePreview(outfit) {
      return getThemeById(outfit?.themeId)?.preview || 'default';
    },
    openPreview() {
      if (this.previewOpen) return;
      if (!this.guardApply('preview-open')) return;
      beginThemePreview();
      this.previewMode = 'outfit';
      this.previewItem = null;
      this.previewModel = composePreviewOutfit({
        isMiniProgram: this.isMiniProgram,
      });
      this.previewOpen = true;
      trackThemePreview('theme', this.activeTheme, 'live');
    },
    onPreviewOutfit(outfit) {
      if (this.previewOpen) return;
      if (!this.guardApply('preview-open')) return;
      beginThemePreview();
      this.previewMode = 'mix';
      this.previewItem = null;
      this.previewOutfit = outfit;
      this.previewModel = composePreviewOutfit({
        themeId: outfit?.themeId,
        localDress: outfit?.localDress,
        overlay: outfit?.overlay,
        isMiniProgram: this.isMiniProgram,
      });
      this.previewOpen = true;
      trackThemePreview('theme', getThemeById(outfit?.themeId), 'live');
    },
    openLivePreview(kind, item) {
      if (!canLivePreview(item)) {
        notify({ title: '该主题暂未开放，敬请期待' });
        return;
      }
      if (this.previewOpen) return;
      if (!this.guardApply('preview-open')) return;
      this.previewMode = kind;
      this.previewItem = item;
      beginThemePreview();
      this.previewModel = composePreviewOutfit({
        themeId: kind === 'theme' ? item.id : this.activeTheme.id,
        extraDress: kind === 'dress' ? item : null,
        isMiniProgram: this.isMiniProgram,
      });
      this.previewOpen = true;
      trackThemePreview(kind, item, 'live');
    },
    canLivePreviewItem(item) {
      return canLivePreview(item);
    },
    closePreview() {
      abortThemePreview();
      this.previewOpen = false;
      this.previewItem = null;
      this.previewOutfit = null;
      this.previewModel = null;
    },
    async onConfirmPreview() {
      if (!this.guardApply(`preview:${this.previewMode}`)) return;
      const skipped = this.livePreviewModel.skipped || [];
      if (this.previewMode === 'theme' && this.previewItem) {
        const result = await persistActiveTheme(this.previewItem.id);
        if (!result.ok) {
          this.notifyPersist(result);
          notify({ title: this.persistFailTitle(result.reason) });
          return;
        }
        this.notifyPersist(result);
        if (result.reason === 'rate') {
          this.closePreview();
          this.closeDetail();
          this.refreshOutfit();
          return;
        }
        trackThemeApply({
          kind: 'theme',
          item: this.previewItem,
          result: 'success',
        });
      } else if (this.previewMode === 'dress' && this.previewItem) {
        const result = await persistLocalDress(this.previewItem.group, this.previewItem.id);
        if (!result.ok) {
          this.notifyPersist(result);
          notify({
            title: result.reason === 'upcoming'
              ? '装扮素材即将上线'
              : this.persistFailTitle(result.reason),
          });
          return;
        }
        this.notifyPersist(result);
        if (result.reason === 'rate') {
          this.closePreview();
          this.closeDetail();
          this.refreshOutfit();
          return;
        }
        trackThemeApply({
          kind: 'dress',
          item: this.previewItem,
          result: 'success',
        });
      } else if (this.previewMode === 'mix' && this.previewOutfit) {
        const result = applySavedOutfit(this.previewOutfit, { isMiniProgram: this.isMiniProgram });
        if (!result.ok) {
          notify({ title: THEME_FAULT_TOAST.mixBroken });
          return;
        }
        trackThemeApplyMix(this.previewOutfit, { hasUnavailable: Boolean(result.skipped) });
        this.closePreview();
        this.refreshOutfit();
        this.notifyApplyMix(result);
        return;
      } else {
        await persistCurrentOutfit();
        trackThemeApply({
          kind: 'theme',
          item: this.activeTheme,
          isMix: true,
          result: 'success',
        });
      }
      this.closePreview();
      this.closeDetail();
      this.refreshOutfit();
      notifySuccess('装扮已生效');
      if (skipped.some((row) => row.blocked)) {
        notify({ title: '部分装扮当前环境无法生效，已跳过' });
      }
    },
    async onResetDress() {
      const confirmed = await confirmDialog({
        title: '重置全部装扮？',
        content: '确定重置所有装扮？将恢复系统默认样式，已保存的搭配方案不会删除',
        confirmText: '确定重置',
        danger: true,
      });
      if (!confirmed) return;
      if (!this.guardApply('reset-all')) return;
      trackThemeResetAll({
        themeId: this.activeTheme.id,
        dressCount: this.appliedDress.filter((entry) => entry.item).length,
      });
      await resetAllDress();
      this.closePreview();
      this.refreshOutfit();
      notifySuccess('已恢复为默认样式');
    },
    async onOverlayChange(value) {
      const enabled = typeof value === 'object' ? Boolean(value?.value) : Boolean(value);
      if (enabled === this.overlay) return;
      if (enabled && Object.keys(getLocalDressMap()).length > 0) {
        const confirmed = await confirmDialog({
          title: '开启全局主题覆盖？',
          content: '开启全局主题覆盖局部装扮后，自定义局部装扮将不会生效，是否继续？',
          confirmText: '确认开启',
          cancelText: '取消',
        });
        if (!confirmed) {
          this.overlay = false;
          return;
        }
      }
      setOverlayLocalDress(enabled);
      trackThemeSwitchConflict(enabled);
      this.refreshOutfit();
    },
  },
};
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}

.search-form {
  min-width: 0;
  flex: 1;
}

.search-go {
  flex-shrink: 0;
  margin-bottom: var(--space-2);
}

.hot-scroll {
  margin-top: var(--space-2);
}

.hot-copy {
  margin-bottom: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.filter-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.filter-row.wrap {
  flex-wrap: wrap;
  white-space: normal;
}

.filter-sheet .note-title {
  margin-top: var(--space-3);
}

.tabs {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  overflow: hidden;
}

.tab {
  flex: 1;
  padding: var(--space-2) var(--space-1);
  text-align: center;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.tab.active {
  color: var(--on-accent-color);
  background: var(--accent-color);
  font-weight: 700;
}

.pane {
  margin-top: var(--space-3);
}

.section-title {
  margin-top: var(--space-1);
  font-weight: 700;
}

.current-card,
.intro-card,
.dress-card,
.outfit,
.recent-block {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.current-card,
.dress-card {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.current-copy,
.dress-body {
  min-width: 0;
  flex: 1;
}

.kicker,
.stale-note,
.note-title,
.soon-line,
.status-line,
.foot-note {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.stale-note {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.current-name,
.theme-name,
.sheet-title {
  margin-top: var(--space-1);
  font-weight: 700;
}

.muted,
.intro {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}

.filter-scroll {
  width: 100%;
  margin-top: var(--space-3);
  white-space: nowrap;
}

.filter-row {
  display: inline-flex;
  gap: var(--space-2);
  padding-bottom: var(--space-1);
}

.filters.appearance {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.chip {
  flex-shrink: 0;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--text-color);
  font-size: var(--font-size-xs);
}

.chip.active {
  border-color: var(--accent-color);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.theme-card,
.coming-card {
  padding: var(--space-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.theme-card.placeholder,
.coming-card,
.dress-card.disabled {
  opacity: 0.84;
}

.coming-card {
  grid-column: 1 / -1;
  padding: var(--space-4);
  text-align: center;
  color: var(--muted-color);
  background: var(--surface-subtle-color);
}

.theme-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.theme-action-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.icon-btn {
  width: 48rpx;
  height: 48rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 48rpx;
  text-align: center;
}

.icon-btn.on {
  color: var(--warning-color);
  background: var(--accent-subtle-color);
}

.icon-btn.disabled {
  opacity: 0.4;
}

.sheet-tools {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 2;
  display: flex;
  gap: var(--space-1);
}

.heat-line,
.social-stats {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.tag {
  flex-shrink: 0;
  padding: 0 var(--space-1);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  line-height: 36rpx;
}

.tag-free {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.tag-soon {
  background: var(--surface-subtle-color);
  color: var(--muted-color);
}

.tag-member,
.tag-event,
.tag-creator {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.tag-ended {
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.tag-style,
.tag-dialect {
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
}

.tag-active {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.acquire-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.acquire-title {
  font-weight: 700;
}

.acquire-go {
  flex-shrink: 0;
  color: var(--accent-color);
  font-size: var(--font-size-sm);
}

.intro-title {
  font-weight: 700;
  line-height: 1.5;
}

.status-ready {
  color: var(--accent-color);
}

.status-blocked {
  color: var(--text-secondary-color);
}

.theme-action {
  margin: var(--space-2) 0 0;
}

.foot-note {
  margin-top: var(--space-3);
  line-height: 1.6;
}

.shot {
  display: flex;
  gap: 8rpx;
  height: 200rpx;
  padding: 8rpx;
  border-radius: var(--radius-md);
  background: var(--page-color);
  box-sizing: border-box;
  overflow: hidden;
}

.shot-wrap {
  position: relative;
}

.shot.blurred {
  filter: blur(6px);
  opacity: 0.7;
}

.soon-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 44rpx;
  transform: translate(-50%, -50%);
}

.shot-sm {
  width: 160rpx;
  height: 120rpx;
  flex-shrink: 0;
}

.shot-xs,
.thumb-xs {
  width: 120rpx;
  height: 88rpx;
  flex-shrink: 0;
}

.thumb-empty {
  background: var(--surface-subtle-color);
}

.recent-scroll {
  width: 100%;
  margin-top: var(--space-2);
  white-space: nowrap;
}

.recent-row {
  display: inline-flex;
  gap: var(--space-2);
}

.recent-card {
  width: 220rpx;
  padding: var(--space-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  box-sizing: border-box;
}

.recent-card.disabled {
  opacity: 0.56;
}

.recent-name {
  margin-top: var(--space-1);
  font-weight: 600;
  font-size: var(--font-size-sm);
  white-space: normal;
}

.recent-hint {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  white-space: normal;
}

.shot-lg {
  height: 280rpx;
}

.shot-xl {
  width: 100%;
  height: 520rpx;
}

.shot-photo {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.zoom-sheet {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: var(--space-4) var(--space-3);
  background: var(--page-color);
  box-sizing: border-box;
}

.zoom-area {
  width: 100%;
  height: 0;
  flex: 1;
  margin-top: var(--space-3);
}

.zoom-view {
  width: 100%;
  height: 100%;
}

.preview-close {
  align-self: flex-end;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
}

.shot-home,
.shot-me {
  flex: 1;
  padding: 8rpx;
  border-radius: var(--radius-sm);
  background: var(--dress-home-bg-background, var(--surface-color));
  box-sizing: border-box;
}

.shot-home {
  position: relative;
  background-color: var(--page-color);
  letter-spacing: var(--dress-letter-spacing, 0em);
}

.shot-home::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  opacity: var(--dress-grain-opacity, 0);
  background-image: var(--dress-grain-image, none);
  background-size: var(--dress-grain-size, 46rpx 46rpx);
}

.shot-nav,
.shot-tab,
.shot-feed,
.shot-line,
.shot-avatar {
  position: relative;
  z-index: 1;
  border-radius: var(--radius-sm);
  background: var(--accent-color);
}

.shot-nav {
  background: var(--dress-nav-bar-background, var(--accent-color));
}

.shot-tab {
  background: var(--dress-tab-bar-background, var(--accent-color));
  border: 1px solid var(--dress-tab-bar-border-color, transparent);
}

.shot-feed {
  background: var(--dress-card-background, var(--accent-subtle-color));
  border-radius: var(--dress-card-border-radius, var(--radius-sm));
  box-shadow: var(--dress-card-shadow, none);
  border: var(--dress-card-border-width, 0px) solid var(--dress-card-border-color, transparent);
}

.shot-nav,
.shot-tab {
  height: 16rpx;
}

.shot-tab {
  margin-top: auto;
}

.shot-home {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.shot-feed {
  height: 28rpx;
}

.shot-feed.thin,
.shot-line.short {
  width: 62%;
  height: 16rpx;
}

.shot-me {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.shot-avatar {
  width: 36rpx;
  height: 36rpx;
  margin-top: 8rpx;
  border-radius: var(--radius-pill);
  border:
    var(--dress-avatar-frame-border-width, 0px)
    solid var(--dress-avatar-frame-border-color, transparent);
}

.shot-line {
  width: 80%;
  height: 12rpx;
  background: var(--accent-subtle-color);
}

.shot-simple {
  background: var(--surface-subtle-color);
}

.shot-dialect {
  background: var(--accent-preview-tea);
}

.shot-retro {
  background: var(--accent-preview-osmanthus);
}

.shot-festival {
  background: var(--accent-preview-clay);
}

.shot-folk {
  background: var(--accent-preview-osmanthus);
}

.shot-season {
  background: var(--accent-preview-tea);
}

.shot-cyber {
  background: var(--accent-preview-ink);
}

.shot-guofeng {
  background: var(--accent-preview-tea);
}

.shot-street {
  background: var(--accent-preview-clay);
}

.shot-anime {
  background: var(--accent-subtle-color);
}

.shot-dark {
  background: var(--accent-preview-ink);
}

.thumb {
  width: 128rpx;
  height: 128rpx;
  padding: var(--space-1);
  border-radius: var(--radius-md);
  background: var(--page-color);
  box-sizing: border-box;
  flex-shrink: 0;
}

.thumb-bar,
.thumb-card {
  border-radius: var(--radius-sm);
  background: var(--accent-color);
}

.thumb-bar {
  height: 18rpx;
}

.thumb-card {
  height: 36rpx;
  margin-top: var(--space-1);
  background: var(--surface-color);
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.thumb-navbar .thumb-bar {
  height: 28rpx;
}

.thumb-tabbar {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.thumb-tabbar .thumb-bar {
  height: 28rpx;
}

.thumb-actions .thumb-card {
  width: 44rpx;
  height: 44rpx;
  border-radius: var(--radius-pill);
  background: var(--accent-color);
}

.thumb-profile {
  background: var(--accent-subtle-color);
}

.thumb-avatar .thumb-card {
  width: 56rpx;
  height: 56rpx;
  margin: 20rpx auto 0;
  border-radius: var(--radius-pill);
  box-shadow: 0 0 0 4rpx var(--gilt-color);
}

.thumb-comment .thumb-card {
  width: 72%;
  height: 44rpx;
  border-radius: var(--radius-md);
}

.thumb-topic .thumb-bar {
  width: 40%;
}

.thumb-chrome .thumb-card {
  height: 28rpx;
  margin-top: var(--space-3);
}

.outfit-row,
.overlay-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.overlay-copy {
  min-width: 0;
  flex: 1;
}

.action-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.preview-corner {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  z-index: 2;
  max-width: 70%;
  padding: 0 var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--warning-color);
  font-size: var(--font-size-xs);
  line-height: 36rpx;
}

.preview-label {
  margin-top: var(--space-3);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.preview-feed {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8rpx;
}

.dress-navbar .shot-nav {
  height: 24rpx;
  box-shadow: 0 0 0 2rpx var(--gilt-color);
}

.dress-tabbar .shot-tab {
  height: 24rpx;
  border-radius: var(--radius-pill);
}

.dress-actions .shot-feed {
  width: 40%;
  border-radius: var(--radius-pill);
}

.dress-cards .shot-feed {
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.dress-profile .shot-me {
  background: var(--accent-subtle-color);
}

.dress-avatar .shot-avatar {
  box-shadow: 0 0 0 4rpx var(--gilt-color);
}

.sheet-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  box-sizing: border-box;
}

.sheet-mask-dim {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: var(--text-color);
  opacity: 0.46;
}

.sheet {
  position: relative;
  z-index: 1;
  width: 100%;
  max-height: 80vh;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  box-sizing: border-box;
  overflow: auto;
}

.hint-row {
  margin-top: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  line-height: 1.55;
}

.hint-row.warn {
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
}

.feature-title {
  margin-top: var(--space-3);
  font-weight: 700;
  font-size: var(--font-size-sm);
}

.feature-item {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}

.empty-wrap {
  margin-top: var(--space-3);
}

.sheet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.sheet-actions .base-button {
  flex: 1;
}

.pressable {
  transition: opacity 200ms ease, transform 200ms ease;
}

.pressable:active {
  opacity: 0.72;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .pressable {
    transition: none;
  }

  .pressable:active {
    transform: none;
  }
}
</style>
