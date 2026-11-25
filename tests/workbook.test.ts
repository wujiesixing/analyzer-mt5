import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { importFile } from '../src/lib/importer.ts'
test('真实xlsx字节读取，跳过说明页并识别中文交易与费用', async () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['账户信息']]),
    '说明',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        '时间',
        '订单',
        '品种',
        '类型',
        '手数',
        '利润',
        '手续费',
        '库存费',
        '费用',
        'Magic',
        '备注',
      ],
      [
        '2025.01.01 12:00:00',
        123,
        'XAUUSD',
        '买入',
        0.1,
        100,
        -2,
        -1,
        -0.5,
        123,
        '测试EA',
      ],
    ]),
    '交易',
  )
  const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const result = await importFile(new Blob([bytes]))
  assert.equal(result.sheet, '交易')
  assert.equal(result.trades[0].net, 96.5)
  assert.equal(result.trades[0].magic, '123')
  assert.equal(result.trades[0].direction, 'buy')
})
