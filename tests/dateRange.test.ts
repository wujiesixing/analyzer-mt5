import test from 'node:test'
import assert from 'node:assert/strict'
import { datesFromRatios, rangeRatios } from '../src/lib/dateRange.ts'

test('滑块贴满整段时等同于清空开始和结束日期', () => {
  assert.deepEqual(datesFromRatios('2026-01-01', '2026-01-11', 0, 1), {
    from: '',
    to: '',
  })
  assert.deepEqual(rangeRatios('2026-01-01', '2026-01-11', '', ''), [0, 1])
})

test('滑块比例按天吸附，并与日期筛选来回对应', () => {
  const picked = datesFromRatios('2026-01-01', '2026-01-11', 0.2, 0.7)
  assert.equal(picked.from, '2026-01-03')
  assert.equal(picked.to, '2026-01-08')
  const [start, end] = rangeRatios(
    '2026-01-01',
    '2026-01-11',
    picked.from,
    picked.to,
  )
  assert.ok(Math.abs(start - 0.2) < 0.001)
  assert.ok(Math.abs(end - 0.7) < 0.001)
})
