# Notifyra Frontend 开发指南

## 1. 目标

本指南用于统一 frontend 的开发方式，保证在新对话或换模型后仍能快速延续当前设计方向。

---

## 2. 前端实现优先级

前端开发优先保证：
- 页面结构正确
- 与设计稿一致
- 暗黑主题一致
- 间距、层级、玻璃态风格统一
- 页面交互闭环完整

---

## 3. 前端开发前必须确认

- 当前页面对应哪一部分设计
- 已有哪些原型或实现可以复用
- 是样式优化、结构调整，还是交互功能补充
- 是否涉及暗黑模式适配
- 是否会影响已完成页面的一致性

---

## 4. 前端开发原则

- 先保证布局正确，再做细节打磨
- 不为了局部小问题破坏全局统一性
- 不随意改动已确认的整体风格方向
- 样式改动优先局部闭环验证

---

## 5. 适配约定

涉及样式修改时，应同时检查：
- 默认主题
- dark 主题
- 卡片背景一致性
- 表头 / switch / 选择器等细节组件
- 间距与层级是否统一

---

## 6. 前端 review 重点

重点检查：
- 是否符合设计稿
- 是否破坏整体布局
- 是否存在明显的 dark 模式漏适配
- 是否出现局部优化导致全局不一致
- 是否引入无必要结构复杂度

---

## 7. 完成标准

前端任务完成至少应说明：
- 页面结构符合设计
- 相关主题都已检查
- 关键交互已验证
- 无明显视觉断层

---

## 8. 移动端适配规范

### 8.1 布局结构

- 移动端（≤768px）隐藏侧边栏（`.sidebar-shell { display: none }`）
- 底部 Tab Bar 通过 `position: fixed` 悬浮在页面底部，**不在 `app-shell` 内部**，避免被 `overflow: hidden` 裁剪
- `app-content` 在移动端使用 `height: 100dvh`（`dvh` 兼容移动端浏览器地址栏），底部 `padding-bottom: 112px` 防止内容被 Tab Bar 遮挡

### 8.2 底部 Tab Bar 实现

- 组件位置：`frontend/src/components/layout/AppShell.tsx`
- 只展示 4 个主要导航项：**概览、通知、渠道、设置**（不展示记录和测试）
- 图标使用 `lucide-react`，不使用 emoji
- 路由路径：`/overview`、`/notifications`、`/channels`、`/settings`（与 `Sidebar.tsx` 中的 `navItems` 保持一致）

### 8.3 液态玻璃胶囊样式

- 悬浮胶囊：`border-radius: 999px`，`bottom: 20px`，`left: 50%` + `translateX(-50%)` 居中
- 宽度：`calc(100% - 48px)`，两侧各留 24px 边距
- 玻璃效果：`backdrop-filter: blur(32px) saturate(2)`，半透明白色背景，高光内阴影
- 深色模式：`background: rgba(15, 23, 42, 0.55)`，单独用 `:root[data-theme='dark']` 覆盖

### 8.4 滑动切换动画

- 使用绝对定位的 `.mobile-tab-indicator` div 作为背景滑块
- 在 `AppShell.tsx` 中用 `useLocation` 计算 `activeIndex`，通过 `style={{ transform: translateX(${activeIndex * 100}%) }}` 定位
- 每个 Tab 宽度 `25%`（4个Tab均分），指示器同宽
- 动画：`transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`（带回弹）
- `position: fixed` 本身作为绝对定位子元素的包含块，加 `isolation: isolate` 确保层叠上下文

### 8.5 注意事项

- 去掉移动端点击高亮：`.mobile-tab { -webkit-tap-highlight-color: transparent }`
- 媒体查询顺序：基础样式 → `@media (max-width: 1200px)` → `@media (max-width: 900px)` → `@media (max-width: 768px)`
- `app-shell` 在移动端去掉 `overflow: hidden`，内容才能延伸到 Tab Bar 下方产生毛玻璃模糊效果
