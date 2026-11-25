import {
  LayoutDashboard,
  ArrowRightLeft,
  Wallet,
  Layers3,
  ChartNoAxesCombined,
  GitCompareArrows,
  Settings2,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { PageId } from '../types/trading.ts'
interface NavSection {
  label: string
  items: { id: PageId; name: string; icon: Component }[]
}
export const nav: NavSection[] = [
  {
    label: '账户',
    items: [
      { id: 'dashboard', name: '账户总览', icon: LayoutDashboard },
      { id: 'trades', name: '交易明细', icon: ArrowRightLeft },
      { id: 'funds', name: '资金明细', icon: Wallet },
    ],
  },
  {
    label: '分析',
    items: [
      { id: 'strategies', name: '策略管理', icon: Layers3 },
      { id: 'analysis', name: '绩效分析', icon: ChartNoAxesCombined },
      { id: 'correlation', name: '策略相关性', icon: GitCompareArrows },
    ],
  },
  {
    label: '管理',
    items: [{ id: 'settings', name: '设置与备份', icon: Settings2 }],
  },
]
export const titles: Record<PageId, [string, string]> = {
  dashboard: ['账户总览', '从每一笔交易，读懂你的策略。'],
  trades: ['交易明细', '检索、筛选与导出已平仓交易。'],
  funds: ['资金明细', '查看账户入金与出金记录。'],
  strategies: ['策略管理', '按开仓备注前缀归类你的 EA 策略。'],
  analysis: ['绩效分析', '筛选交易，发现收益的来源。'],
  correlation: ['策略相关性', '比较各策略×品种在相同日期的盈亏相关性。'],
  settings: ['设置与备份', '管理账户参数和浏览器本地数据。'],
}
