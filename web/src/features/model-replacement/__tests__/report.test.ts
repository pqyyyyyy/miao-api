/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, it } from 'vitest'

import {
  buildHealthPoints,
  channelsForModel,
  getRecordMatchPercent,
  getRecordVerdict,
  healthSeriesDomain,
  splitByLatestVerdict,
  todayRange,
} from '../lib/report'
import type { DetectionRecord } from '../types'

function record(overrides: Partial<DetectionRecord> = {}): DetectionRecord {
  return {
    id: 1,
    run_id: 'run-1',
    channel_id: 7,
    channel_name: 'upstream',
    verdict: 'replaced',
    match_percent: 50,
    actions: [],
    error_message: '',
    avg_latency_ms: 800,
    started_at: 1_700_000_000,
    finished_at: 1_700_000_030,
    created_at: 1_700_000_031,
    models: [
      {
        model: 'gpt-4o',
        total: 2,
        matched: 2,
        mismatched: 0,
        failed: 0,
        match_percent: 100,
        mismatch_percent: 0,
        verdict: 'passed',
      },
      {
        model: 'claude',
        total: 2,
        matched: 1,
        mismatched: 1,
        failed: 0,
        match_percent: 50,
        mismatch_percent: 50,
        verdict: 'replaced',
      },
    ],
    ...overrides,
  }
}

describe('record percentages', () => {
  it('uses the worst model when no model is selected', () => {
    expect(getRecordMatchPercent(record(), null)).toBe(50)
    expect(getRecordVerdict(record(), null)).toBe('replaced')
  })

  it('uses the selected model when one is selected', () => {
    expect(getRecordMatchPercent(record(), 'gpt-4o')).toBe(100)
    expect(getRecordVerdict(record(), 'gpt-4o')).toBe('passed')
  })

  it('returns null when the selected model was not detected in the record', () => {
    expect(getRecordMatchPercent(record(), 'gemini')).toBeNull()
    expect(getRecordVerdict(record(), 'gemini')).toBeNull()
  })
})

describe('buildHealthPoints', () => {
  it('skips runs that did not detect the selected model instead of plotting 0%', () => {
    const withoutClaude = record({
      id: 2,
      run_id: 'run-2',
      started_at: 1_700_000_600,
      models: [record().models[0]],
      match_percent: 100,
      verdict: 'passed',
    })

    const points = buildHealthPoints([record(), withoutClaude], 'claude')

    expect(points.map((point) => point.recordId)).toEqual([1])
    expect(points[0]).toMatchObject({ percent: 50, verdict: 'replaced' })
  })

  it('aligns the channels of one run on the run start and orders them by channel', () => {
    const later = record({
      id: 3,
      channel_id: 2,
      channel_name: 'beta',
      started_at: 1_700_000_020,
      match_percent: 100,
      verdict: 'passed',
    })
    const nextRun = record({
      id: 4,
      run_id: 'run-2',
      started_at: 1_700_000_600,
    })

    const points = buildHealthPoints([later, record(), nextRun], null)

    expect(points.map((point) => [point.recordId, point.series])).toEqual([
      [3, '#2 beta'],
      [1, '#7 upstream'],
      [4, '#7 upstream'],
    ])
    expect(points[0].time).toBe(points[1].time)
    expect(points[2].time).not.toBe(points[0].time)
  })
})

describe('healthSeriesDomain', () => {
  it('lists each channel once in channel ID order so colors follow the channel', () => {
    const domain = healthSeriesDomain([
      record({ channel_id: 9, channel_name: 'zeta' }),
      record({ channel_id: 2, channel_name: 'beta' }),
      record({ id: 5, channel_id: 9, channel_name: 'zeta' }),
    ])

    expect(domain).toEqual(['#2 beta', '#9 zeta'])
  })
})

describe('splitByLatestVerdict', () => {
  it('puts passed channels in the healthy list, others in the abnormal list, and skips undetected ones', () => {
    const rows = [
      { id: 1, latest: record({ verdict: 'passed' }) },
      { id: 2, latest: record({ verdict: 'replaced' }) },
      { id: 3, latest: record({ verdict: 'failed' }) },
      { id: 4, latest: null },
    ]

    const lists = splitByLatestVerdict(rows)

    expect(lists.healthy.map((row) => row.id)).toEqual([1])
    expect(lists.abnormal.map((row) => row.id)).toEqual([2, 3])
  })
})

describe('channelsForModel', () => {
  it('keeps only channels whose latest run detected the selected model', () => {
    const rows = [
      { id: 1, latest: record() },
      {
        id: 2,
        latest: record({ models: [record().models[0]] }),
      },
      { id: 3, latest: null },
    ]

    expect(channelsForModel(rows, 'claude').map((row) => row.id)).toEqual([1])
    expect(channelsForModel(rows, null).map((row) => row.id)).toEqual([1, 2, 3])
  })
})

describe('todayRange', () => {
  it('covers the whole local day of the given time', () => {
    const range = todayRange(new Date(2026, 10, 5, 14, 30))

    expect(range.start).toEqual(new Date(2026, 10, 5, 0, 0, 0, 0))
    expect(range.end).toEqual(new Date(2026, 10, 5, 23, 59, 59, 999))
  })
})
