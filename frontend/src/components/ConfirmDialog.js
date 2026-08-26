/**
 * 确认弹窗原语（M1·设计系统）
 *
 * 统一使用 TDesign FeedbackHost；尚未迁移的旧页面自动回退到 uni.showModal。
 *
 * 用法：
 *   import confirmDialog from '@/components/ConfirmDialog';
 *   const confirmed = await confirmDialog({
 *     title: '删除这个罐头？',
 *     content: '删除后无法恢复',
 *     danger: true,
 *   });
 *   if (confirmed) { ... }
 */

import { confirm } from '@/services/feedback';

export default function confirmDialog(options = {}) {
  return confirm(options);
}
