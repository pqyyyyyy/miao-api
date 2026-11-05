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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatPercent, formatTimestampToDate } from '@/lib/format'

import type { DetectionChannelRow } from '../../types'
import { ChannelStatusBadge, VerdictBadge } from './badges'

type HealthTab = 'healthy' | 'abnormal'

type HealthChannelTabsProps = {
  healthy: DetectionChannelRow[]
  abnormal: DetectionChannelRow[]
}

/**
 * Lists channels by their latest detection result. The lists are kept by
 * detection itself, not read from channel groups, so a channel appears only
 * after it has been detected and moves when a later run changes its result.
 */
export function HealthChannelTabs(props: HealthChannelTabsProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<HealthTab>('healthy')

  const columns: StaticDataTableColumn<DetectionChannelRow>[] = [
    {
      id: 'channel',
      header: t('Channel'),
      cell: (row) => (
        <span className='truncate'>
          <span className='text-muted-foreground tabular-nums'>#{row.id}</span>{' '}
          {row.name}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('Status'),
      cell: (row) => <ChannelStatusBadge status={row.status} />,
    },
    {
      id: 'verdict',
      header: t('Latest result'),
      cell: (row) => <VerdictBadge verdict={row.latest?.verdict ?? null} />,
    },
    {
      id: 'percent',
      header: t('Match rate'),
      cell: (row) => (
        <span className='tabular-nums'>
          {formatPercent(row.latest?.match_percent)}
        </span>
      ),
    },
    {
      id: 'groups',
      header: t('Groups'),
      cell: (row) => row.groups.join(', ') || '-',
    },
    {
      id: 'tested',
      header: t('Last tested'),
      cell: (row) => formatTimestampToDate(row.latest?.finished_at),
    },
  ]

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as HealthTab)}>
      <TabsList aria-label={t('Healthy and abnormal channels')}>
        <TabsTrigger value='healthy'>
          {t('Healthy channels ({{count}})', { count: props.healthy.length })}
        </TabsTrigger>
        <TabsTrigger value='abnormal'>
          {t('Abnormal channels ({{count}})', { count: props.abnormal.length })}
        </TabsTrigger>
      </TabsList>
      <TabsContent value='healthy'>
        <StaticDataTable
          columns={columns}
          data={props.healthy}
          getRowKey={(row) => row.id}
          tableClassName='min-w-[720px]'
          emptyContent={t('No channels in this list.')}
        />
      </TabsContent>
      <TabsContent value='abnormal'>
        <StaticDataTable
          columns={columns}
          data={props.abnormal}
          getRowKey={(row) => row.id}
          tableClassName='min-w-[720px]'
          emptyContent={t('No channels in this list.')}
        />
      </TabsContent>
    </Tabs>
  )
}
