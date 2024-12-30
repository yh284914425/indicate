import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import CryptoDivergence from '../components/CryptoDivergence.vue'
import MultiPeriodAnalysis from '../components/MultiPeriodAnalysis.vue'
import DivergenceStats from '../components/DivergenceStats.vue'
import DailyOverview from '../components/DailyOverview.vue'
import CustomTradingView from '../components/CustomTradingView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/multi-period'
    },
    {
      path: '/single',
      name: 'single',
      component: CryptoDivergence
    },
    {
      path: '/multi-period',
      name: 'multi-period',
      component: MultiPeriodAnalysis
    },
    {
      path: '/multi-symbol',
      name: 'multi-symbol',
      component: DivergenceStats
    },
    {
      path: '/daily',
      name: 'daily',
      component: DailyOverview
    },
    {
      path: '/custom-chart',
      name: 'custom-chart',
      component: CustomTradingView
    }
  ]
})

export default router
