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
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import {
  getModelReplacementHistory,
  modelReplacementQueryKeys,
} from '../../api'
import {
  buildHealthPoints,
  channelsForModel,
  healthSeriesDomain,
  todayRange,
} from '../../lib/report'
import type { DetectionChannelRow } from '../../types'
import { HealthChart } from './health-chart'
import { RecordDetail } from './record-detail'

const ALL = '__all__'

type ChannelReportPanelProps = {
  channels: DetectionChannelRow[]
  /** Configured detection models, for the model filter. */
  models: string[]
  /** Null shows every channel as its own line. */
  channelId: number | null
  onChannelChange: (channelId: number | null) => void
  recordId: number | null
  onRecordChange: (recordId: number | null) => void
}

export function ChannelReportPanel(props: ChannelReportPanelProps) {
  const { t } = useTranslation()
  const [model, setModel] = useState<string | null>(null)
  const [range, setRange] = useState(() => todayRange())

  const start = Math.floor(range.start.getTime() / 1000)
  const end = Math.floor(range.end.getTime() / 1000)
  const historyQuery = useQuery({
    queryKey: modelReplacementQueryKeys.history({
      channelId: props.channelId,
      start,
      end,
    }),
    queryFn: async () =>
      requireServerSuccess(
        await getModelReplacementHistory({
          channelId: props.channelId,
          start,
          end,
        })
      ).data ?? [],
  })

  const modelChannels = useMemo(
    () => channelsForModel(props.channels, model),
    [model, props.channels]
  )
  const channelOptions = useMemo(
    () => [
      { value: ALL, label: t('All channels') },
      ...modelChannels.map((channel) => ({
        value: String(channel.id),
        label: `#${channel.id} ${channel.name}`,
      })),
    ],
    [modelChannels, t]
  )
  const modelItems = useMemo(
    () => [
      { value: ALL, label: t('All models (worst)') },
      ...props.models.map((name) => ({ value: name, label: name })),
    ],
    [props.models, t]
  )
  const records = useMemo(() => historyQuery.data ?? [], [historyQuery.data])
  const points = useMemo(
    () => buildHealthPoints(records, model),
    [records, model]
  )
  const seriesDomain = useMemo(() => healthSeriesDomain(records), [records])
  const detailOpen = props.recordId != null

  const handleModelChange = (value: string | null) => {
    const next = !value || value === ALL ? null : value
    setModel(next)
    props.onRecordChange(null)
    const stillServed = channelsForModel(props.channels, next).some(
      (channel) => channel.id === props.channelId
    )
    if (props.channelId != null && !stillServed) props.onChannelChange(null)
  }

  let body = (
    <HealthChart
      points={points}
      seriesDomain={seriesDomain}
      selectedRecordId={props.recordId}
      onSelectRecord={props.onRecordChange}
    />
  )
  if (historyQuery.isLoading) {
    body = <LoadingState className='h-full' />
  } else if (historyQuery.isError) {
    body = (
      <ErrorState
        title={t('We could not load the detection history.')}
        onRetry={() => void historyQuery.refetch()}
      />
    )
  } else if (points.length === 0) {
    body = (
      <p className='text-muted-foreground flex h-full items-center justify-center rounded-md border border-dashed px-4 text-center text-sm'>
        {t('No detection history for this selection yet.')}
      </p>
    )
  }

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]'>
        <div className='grid gap-1.5'>
          <Label htmlFor='model-replacement-report-channel'>
            {t('Channel')}
          </Label>
          <Combobox
            id='model-replacement-report-channel'
            options={channelOptions}
            value={props.channelId == null ? ALL : String(props.channelId)}
            onValueChange={(value) => {
              props.onRecordChange(null)
              props.onChannelChange(
                !value || value === ALL ? null : Number(value)
              )
            }}
            placeholder={t('All channels')}
            className='w-full'
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='model-replacement-report-model'>{t('Model')}</Label>
          <Select
            items={modelItems}
            value={model ?? ALL}
            onValueChange={handleModelChange}
          >
            <SelectTrigger
              id='model-replacement-report-model'
              className='w-full'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {modelItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-1.5 sm:col-span-2 xl:col-span-1'>
          <span className='text-sm leading-none font-medium'>
            {t('Date Range')}
          </span>
          <CompactDateTimeRangePicker
            start={range.start}
            end={range.end}
            onChange={(next) => {
              const today = todayRange()
              props.onRecordChange(null)
              setRange({
                start: next.start ?? today.start,
                end: next.end ?? today.end,
              })
            }}
            className='w-full'
          />
        </div>
      </div>
      <p className='text-muted-foreground text-xs'>
        {t('Click a point on the chart to see the requests of that run.')}
      </p>
      <div
        className={cn(
          'grid min-w-0 gap-4',
          detailOpen && 'lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]'
        )}
      >
        {/*
          The chart fills this cell. With the detail panel open the cell
          stretches to the panel's height, and the chart redraws at that size.
        */}
        <div
          className={cn(
            'relative h-72 min-w-0 sm:h-80',
            detailOpen && 'lg:h-auto lg:min-h-80'
          )}
        >
          <div className='absolute inset-0'>{body}</div>
        </div>
        {detailOpen && (
          <RecordDetail
            recordId={props.recordId ?? 0}
            onClose={() => props.onRecordChange(null)}
          />
        )}
      </div>
    </div>
  )
}
