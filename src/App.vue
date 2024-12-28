<template>
  <n-config-provider :theme="theme">
    <n-message-provider>
      <n-layout class="layout">
        <n-layout-header class="header">
          <div class="header-content">
            <div class="logo">
              <n-gradient-text :size="24" type="primary">
                Crypto Analysis
              </n-gradient-text>
            </div>
            <n-menu 
              v-model:value="activeKey" 
              mode="horizontal" 
              :options="menuOptions"
              class="main-menu"
            />
          </div>
        </n-layout-header>
        <n-layout-content class="content">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </n-layout-content>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { h, ref, computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { darkTheme, lightTheme, NIcon, NMessageProvider, NGradientText } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { BarChartOutline, StatsChartOutline, PieChartOutline, TrendingUpOutline, AnalyticsOutline } from '@vicons/ionicons5'

// 根据系统主题自动切换
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const theme = computed(() => prefersDark ? darkTheme : lightTheme)

const route = useRoute()
const activeKey = computed(() => route.path.slice(1) || 'home')

function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions: MenuOption[] = [
  {
    label: () =>
      h(
        RouterLink,
        {
          to: '/single'
        },
        { default: () => '单币种分析' }
      ),
    key: 'single',
    icon: renderIcon(BarChartOutline)
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: '/multi-period'
        },
        { default: () => '多周期分析' }
      ),
    key: 'multi-period',
    icon: renderIcon(StatsChartOutline)
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: '/multi-symbol'
        },
        { default: () => '多币种统计' }
      ),
    key: 'multi-symbol',
    icon: renderIcon(PieChartOutline)
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: '/daily'
        },
        { default: () => '当日概览' }
      ),
    key: 'daily',
    icon: renderIcon(TrendingUpOutline)
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: '/custom-chart'
        },
        { default: () => '自定义图表' }
      ),
    key: 'custom-chart',
    icon: renderIcon(AnalyticsOutline)
  }
]
</script>

<style lang="scss" scoped>
// 变量定义
$header-height: 64px;
$primary-color: #18a058;
$header-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
$content-padding: 24px;
$border-radius: 8px;
$transition-duration: 0.3s;

// 混合器
@mixin flex-center {
  display: flex;
  align-items: center;
}

@mixin glass-effect {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7eb 100%);

  :deep(.n-layout-scroll-container) {
    overflow: hidden;
  }
}

.header {
  height: $header-height;
  padding: 0 $content-padding;
  box-shadow: $header-shadow;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 100;

  .header-content {
    @include flex-center;
    justify-content: space-between;
    height: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 16px;
  }

  .logo {
    margin-right: 24px;
  }

  .main-menu {
    flex: 1;
  }
}

.content {
  flex: 1;
  padding: $content-padding;
  overflow: auto;
  position: relative;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }
}

// 路由切换动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity $transition-duration ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 响应式设计
@media (max-width: 768px) {
  .header {
    padding: 0 12px;

    .header-content {
      padding: 0 8px;
    }

    .logo {
      display: none;
    }
  }

  .content {
    padding: 16px;
  }
}
</style>
