import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/authGuard', () => ({
  requireAuth: vi.fn(() => true),
}));
vi.mock('@/services/canSocial', () => ({
  createCanComment: vi.fn(),
  createNameplateComment: vi.fn(),
  deleteCanComment: vi.fn(),
  likeCanComment: vi.fn(),
  unlikeCanComment: vi.fn(),
  listCanComments: vi.fn(),
  listCommentReplies: vi.fn(),
  listNameplateComments: vi.fn(),
  replyToComment: vi.fn(),
}));

import CommentThread from '@/components/CommentThread.vue';
import { requireAuth } from '@/services/authGuard';
import {
  createCanComment,
  deleteCanComment,
  listCanComments,
  listCommentReplies,
  replyToComment,
} from '@/services/canSocial';

function setupUni() {
  globalThis.uni = {
    getStorageSync: vi.fn(() => ''),
    showToast: vi.fn(),
  };
}

function author(id) {
  return { id, username: `user${id}`, nickname: `昵称${id}`, avatar: '' };
}

function topComment(overrides = {}) {
  return {
    id: 1,
    parent_id: null,
    reply_to: null,
    author: author(1),
    content: '一级评论',
    like_count: 0,
    liked_by_me: false,
    reply_count: 2,
    created_at: '2026-08-27T10:00:00',
    ...overrides,
  };
}

function reply(overrides = {}) {
  return {
    id: 2,
    parent_id: 1,
    reply_to: null,
    author: author(2),
    content: '回复一级',
    like_count: 0,
    liked_by_me: false,
    reply_count: 0,
    created_at: '2026-08-27T10:01:00',
    ...overrides,
  };
}

function mountThread() {
  return mount(CommentThread, {
    props: { targetType: 'can', targetId: 12 },
  });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('CommentThread 二级评论', () => {
  beforeEach(() => {
    // resetAllMocks 同时清空 mockResolvedValueOnce/RejectedValueOnce 队列，避免用例间互相污染。
    vi.resetAllMocks();
    requireAuth.mockReturnValue(true);
    setupUni();
  });

  it('渲染一级评论并显示回复数折叠开关', async () => {
    listCanComments.mockResolvedValue({ results: [topComment()], next: null });
    const wrapper = mountThread();
    await flush();

    expect(listCanComments).toHaveBeenCalledWith(12, { page: 1 });
    expect(wrapper.text()).toContain('一级评论');
    expect(wrapper.text()).toContain('查看 2 条回复');
  });

  it('展开后按 parent_id 拉取回复并平铺展示 @ 前缀', async () => {
    listCanComments.mockResolvedValue({ results: [topComment()], next: null });
    listCommentReplies.mockResolvedValue({
      results: [
        reply(),
        reply({
          id: 3,
          parent_id: 1,
          reply_to: { id: 2, username: 'user2', nickname: '昵称2' },
          content: '回复那条回复',
        }),
      ],
      next: null,
    });
    const wrapper = mountThread();
    await flush();

    await wrapper.find('.comment-block__toggle').trigger('tap');
    await flush();

    expect(listCommentReplies).toHaveBeenCalledWith(1, { page: 1 });
    expect(wrapper.text()).toContain('回复一级');
    expect(wrapper.text()).toContain('回复 @昵称2');
  });

  it('回复一级评论时以该评论为 reply_to 并累加回复数', async () => {
    listCanComments.mockResolvedValue({ results: [topComment()], next: null });
    replyToComment.mockResolvedValue(reply({ id: 9, parent_id: 1, content: '新回复' }));
    const wrapper = mountThread();
    await flush();

    wrapper.vm.startReply(wrapper.vm.comments[0]);
    wrapper.vm.replyDraft = '新回复';
    await wrapper.vm.submitReply();
    await flush();

    expect(replyToComment).toHaveBeenCalledWith(1, '新回复');
    expect(wrapper.vm.comments[0].replies.map((item) => item.id)).toContain(9);
    expect(wrapper.vm.comments[0].reply_count).toBe(3);
  });

  it('回复某条回复时以该回复为 reply_to、根评论为父级', async () => {
    listCanComments.mockResolvedValue({ results: [topComment()], next: null });
    replyToComment.mockResolvedValue(
      reply({ id: 10, parent_id: 1, reply_to: { id: 2, nickname: '昵称2' }, content: '再回复' }),
    );
    const wrapper = mountThread();
    await flush();

    wrapper.vm.startReply(reply({ id: 2, parent_id: 1 }));
    wrapper.vm.replyDraft = '再回复';
    await wrapper.vm.submitReply();
    await flush();

    expect(replyToComment).toHaveBeenCalledWith(2, '再回复');
  });

  it('首屏回复加载失败后折叠再展开可重试（#254）', async () => {
    listCanComments.mockResolvedValue({ results: [topComment()], next: null });
    listCommentReplies
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ results: [reply()], next: null });
    const wrapper = mountThread();
    await flush();

    // 首次展开：加载失败，回复未标记已加载
    await wrapper.find('.comment-block__toggle').trigger('tap');
    await flush();
    expect(wrapper.vm.comments[0].repliesLoaded).toBe(false);
    expect(wrapper.vm.comments[0].replies).toHaveLength(0);

    // 折叠再展开：repliesLoaded 仍为 false，触发重试
    await wrapper.find('.comment-block__toggle').trigger('tap');
    await wrapper.find('.comment-block__toggle').trigger('tap');
    await flush();

    expect(listCommentReplies).toHaveBeenCalledTimes(2);
    expect(wrapper.vm.comments[0].repliesLoaded).toBe(true);
    expect(wrapper.vm.comments[0].replies).toHaveLength(1);
  });

  it('分页加载失败保留已加载回复且可再次重试（#254）', async () => {
    listCanComments.mockResolvedValue({ results: [topComment()], next: null });
    listCommentReplies
      .mockResolvedValueOnce({ results: [reply()], next: 'http://example.com?page=2' })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ results: [reply({ id: 4, parent_id: 1 })], next: null });
    const wrapper = mountThread();
    await flush();

    // 展开并加载第一页（成功）
    await wrapper.find('.comment-block__toggle').trigger('tap');
    await flush();
    expect(wrapper.vm.comments[0].replies).toHaveLength(1);

    // 展开更多：第二页失败 → 已加载回复保留、仍可再点重试
    // 注：TDesign stub（inheritAttrs:false）吞掉 DOM 点击监听，测试里用 $emit('click') 走 BaseButton→CommentThread 的 @click 通道。
    const moreButton = () => wrapper.findAllComponents({ name: 'BaseButton' })
      .find((button) => button.props('text') === '展开更多回复');
    await moreButton().vm.$emit('click');
    await flush();
    expect(wrapper.vm.comments[0].replies).toHaveLength(1);
    expect(wrapper.vm.comments[0].repliesHasMore).toBe(true);

    await moreButton().vm.$emit('click');
    await flush();

    expect(listCommentReplies).toHaveBeenCalledTimes(3);
    expect(wrapper.vm.comments[0].replies).toHaveLength(2);
  });

  it('submitComment 创建并前置新评论，空内容返回 null（#问题2）', async () => {
    listCanComments.mockResolvedValue({ results: [topComment()], next: null });
    createCanComment.mockResolvedValue(topComment({ id: 99, content: '新评论' }));
    const wrapper = mountThread();
    await flush();

    const comment = await wrapper.vm.submitComment('  新评论  ');
    await flush();

    expect(createCanComment).toHaveBeenCalledWith(12, '新评论');
    expect(comment).toBeTruthy();
    expect(wrapper.vm.comments[0].id).toBe(99);

    const empty = await wrapper.vm.submitComment('   ');
    expect(empty).toBeNull();
    expect(createCanComment).toHaveBeenCalledTimes(1);
  });

  it('删除一条回复会从所属一级评论移除并减回复数', async () => {
    listCanComments.mockResolvedValue({ results: [topComment({ reply_count: 1 })], next: null });
    deleteCanComment.mockResolvedValue({});
    const wrapper = mountThread();
    await flush();

    wrapper.vm.comments[0].replies = [reply({ id: 2, parent_id: 1 })];
    wrapper.vm.comments[0].reply_count = 1;

    await wrapper.vm.remove(wrapper.vm.comments[0].replies[0]);
    await flush();

    expect(deleteCanComment).toHaveBeenCalledWith(2);
    expect(wrapper.vm.comments[0].replies).toHaveLength(0);
    expect(wrapper.vm.comments[0].reply_count).toBe(0);
  });
});
