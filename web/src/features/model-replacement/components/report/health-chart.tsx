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
import { VChart } from '@visactor/react-vchart'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useChartTheme } from '@/lib/use-chart-theme'
import { cn } from '@/lib/utils'
import { VCHART_OPTION } from '@/lib/vchart'

import type { HealthPoint } from '../../lib/report'

// Validated categorical palette (dataviz reference instance), fixed order.
const SERIES_COLORS = {
  light: [
    '#2a78d6',
    '#eb6834',
    '#1baf7a',
    '#eda100',
    '#e87ba4',
    '#008300',
    '#6250d6',
    '#e34948',
  ],
  dark: [
    '#3987e5',
    '#d95926',
    '#199e70',
    '#c98500',
    '#d55181',
    '#008300',
    '#9085e9',
    '#e66767',
  ],
}

const VERDICT_POINT_COLORS = {
  passed: '#10b981',
  replaced: '#ef4444',
  failed: '#f59e0b',
} as const

type HealthChartProps = {
  points: HealthPoint[]
  /** Every channel label in a fixed order, so colors follow the channel. */
  seriesDomain: string[]
  selectedRecordId: number | null
  onSelectRecord: (recordId: number) => void
  className?: string
}

export function HealthChart(props: HealthChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()
  const isDark = resolvedTheme === 'dark'
  const textColor = isDark
    ? 'rgba(255, 255, 255, 0.68)'
    : 'rgba(15, 23, 42, 0.58)'
  const gridColor = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(15, 23, 42, 0.12)'
  const overlay = new Set(props.points.map((point) => point.series)).size > 1

  const spec = useMemo(() => {
    const palette = isDark ? SERIES_COLORS.dark : SERIES_COLORS.light
    return {
      type: 'line' as const,
      data: [{ id: 'health', values: props.points }],
      xField: 'time',
      yField: 'percent',
      seriesField: 'series',
      color: {
        type: 'ordinal',
        domain: props.seriesDomain,
        range: props.seriesDomain.map(
          (_, index) => palette[index % palette.length]
        ),
      },
      line: { style: { lineWidth: 2 } },
      point: {
        visible: true,
        style: {
          size: (datum: HealthPoint) =>
            datum.recordId === props.selectedRecordId ? 11 : 8,
          cursor: 'pointer',
          stroke: isDark ? '#1a1a19' : '#ffffff',
          lineWidth: 2,
          ...(overlay
            ? {}
            : {
                fill: (datum: HealthPoint) =>
                  datum.verdict
                    ? VERDICT_POINT_COLORS[datum.verdict]
                    : '#94a3b8',
              }),
        },
      },
      legends: {
        visible: overlay,
        orient: 'bottom' as const,
        item: { label: { style: { fill: textColor } } },
      },
      tooltip: {
        mark: {
          title: { value: (datum: HealthPoint) => datum.time },
          content: [
            {
              key: (datum: HealthPoint) => datum.series,
              value: (datum: HealthPoint) =>
                datum.runs
                  ? `${t('Match rate')} ${datum.percent}% · ${t('Average of {{count}} runs', { count: datum.runs })}`
                  : `${t('Match rate')} ${datum.percent}%`,
            },
          ],
        },
        dimension: {
          title: { value: (datum: HealthPoint) => datum.time },
          content: [
            {
              key: (datum: HealthPoint) => datum.series,
              value: (datum: HealthPoint) =>
                datum.runs
                  ? `${datum.percent}% (${t('Average of {{count}} runs', { count: datum.runs })})`
                  : `${datum.percent}%`,
            },
          ],
        },
      },
      crosshair: {
        xField: {
          visible: true,
          line: { type: 'line', style: { stroke: gridColor } },
        },
      },
      axes: [
        {
          orient: 'bottom',
          label: { style: { fill: textColor, fontSize: 10 }, autoLimit: true },
          tick: { visible: false },
        },
        {
          orient: 'left',
          min: 0,
          max: 100,
          label: {
            formatMethod: (value: number | string) => `${value}%`,
            style: { fill: textColor, fontSize: 10 },
          },
          grid: { visible: true, style: { stroke: gridColor } },
        },
      ],
    }
  }, [
    gridColor,
    isDark,
    overlay,
    props.points,
    props.selectedRecordId,
    props.seriesDomain,
    t,
    textColor,
  ])

  return (
    <div className={cn('h-full w-full', props.className)}>
      {themeReady && (
        <VChart
          key={`model-replacement-health-${resolvedTheme}`}
          spec={{
            ...spec,
            theme: isDark ? 'dark' : 'light',
            background: 'transparent',
          }}
          option={VCHART_OPTION}
          onClick={(event: { datum?: unknown }) => {
            const datum = event.datum as Partial<HealthPoint> | undefined
            if (typeof datum?.recordId === 'number') {
              props.onSelectRecord(datum.recordId)
            }
          }}
        />
      )}
    </div>
  )
}
