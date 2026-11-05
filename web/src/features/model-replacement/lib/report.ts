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
import dayjs from 'dayjs'

import type { DetectionRecord, Verdict } from '../types'

/**
 * Match percentage of a record. With a model selected it is that model's
 * match rate (null when the model was not detected in the record); without
 * one it is the worst match rate across the record's models.
 */
export function getRecordMatchPercent(
  record: DetectionRecord,
  model: string | null
): number | null {
  if (!model) return record.match_percent
  const stat = record.models.find(
    (item) => item.model === model && item.total > 0
  )
  return stat ? stat.match_percent : null
}

/**
 * Verdict of a record for the selected model, or the channel verdict when no
 * model is selected. Null when the model was not detected in the record.
 */
export function getRecordVerdict(
  record: DetectionRecord,
  model: string | null
): Verdict | null {
  if (!model) return record.verdict
  const stat = record.models.find((item) => item.model === model)
  return stat?.verdict ? stat.verdict : null
}

/** Formats a Unix-second range, omitting the end date when it is the same day. */
export function formatTimeRange(startedAt: number, finishedAt: number): string {
  if (!startedAt) return '-'
  const start = dayjs(startedAt * 1000)
  if (!finishedAt) return start.format('YYYY-MM-DD HH:mm:ss')
  const end = dayjs(finishedAt * 1000)
  const endFormat = start.isSame(end, 'day')
    ? 'HH:mm:ss'
    : 'YYYY-MM-DD HH:mm:ss'
  return `${start.format('YYYY-MM-DD HH:mm:ss')} – ${end.format(endFormat)}`
}

export type HealthPoint = {
  recordId: number
  channelId: number
  /** Channel label; one line per channel when several are overlaid. */
  series: string
  time: string
  percent: number
  verdict: Verdict | null
}

export function channelLabel(channel: {
  channel_id: number
  channel_name: string
}): string {
  return `#${channel.channel_id} ${channel.channel_name}`
}

/**
 * Chart points for detection history, one series per channel. Every point of
 * a run uses the run's start time, so the lines of different channels line
 * up. Records that did not detect the selected model are left out instead of
 * being drawn as 0%.
 */
export function buildHealthPoints(
  records: DetectionRecord[],
  model: string | null
): HealthPoint[] {
  const runStart = new Map<string, number>()
  for (const record of records) {
    const start = record.started_at || record.created_at
    const current = runStart.get(record.run_id)
    if (current === undefined || start < current) {
      runStart.set(record.run_id, start)
    }
  }
  const points: (HealthPoint & { start: number })[] = []
  for (const record of records) {
    const percent = getRecordMatchPercent(record, model)
    if (percent == null) continue
    const start = runStart.get(record.run_id) ?? record.created_at
    points.push({
      recordId: record.id,
      channelId: record.channel_id,
      series: channelLabel(record),
      time: dayjs(start * 1000).format('MM-DD HH:mm:ss'),
      start,
      percent: Math.round(percent * 100) / 100,
      verdict: getRecordVerdict(record, model),
    })
  }
  points.sort((a, b) => a.start - b.start || a.channelId - b.channelId)
  return points.map(({ start: _start, ...point }) => point)
}

/**
 * Channel labels in channel ID order. Used as the fixed color domain so a
 * channel keeps its color when a filter hides other channels.
 */
export function healthSeriesDomain(records: DetectionRecord[]): string[] {
  const labels = new Map<number, string>()
  for (const record of records) {
    labels.set(record.channel_id, channelLabel(record))
  }
  return [...labels.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, label]) => label)
}

/**
 * Splits channels by their latest detection result. Channels that were never
 * detected belong to neither list.
 */
export function splitByLatestVerdict<
  T extends { latest: DetectionRecord | null },
>(rows: T[]): { healthy: T[]; abnormal: T[] } {
  const healthy: T[] = []
  const abnormal: T[] = []
  for (const row of rows) {
    if (!row.latest) continue
    if (row.latest.verdict === 'passed') healthy.push(row)
    else abnormal.push(row)
  }
  return { healthy, abnormal }
}

/**
 * Channels whose latest detection covered the model; every channel when no
 * model is selected. Used to narrow the chart's channel choices.
 */
export function channelsForModel<T extends { latest: DetectionRecord | null }>(
  rows: T[],
  model: string | null
): T[] {
  if (!model) return rows
  return rows.filter((row) =>
    row.latest?.models.some((stat) => stat.model === model && stat.total > 0)
  )
}

/** The chart's default date range: today in local time. */
export function todayRange(now: Date = new Date()): { start: Date; end: Date } {
  return {
    start: dayjs(now).startOf('day').toDate(),
    end: dayjs(now).endOf('day').toDate(),
  }
}
