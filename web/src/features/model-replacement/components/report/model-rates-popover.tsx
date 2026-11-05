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
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatPercent } from '@/lib/format'

import { formatTimeRange } from '../../lib/report'
import type { DetectionChannelRow } from '../../types'
import { VerdictBadge } from './badges'

/** Report button that shows the match rate of every model in the latest run. */
export function ModelRatesPopover(props: { row: DetectionChannelRow }) {
  const { t } = useTranslation()
  const latest = props.row.latest
  const models = latest?.models.filter((stat) => stat.total > 0) ?? []

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={!latest}
            aria-label={t('Model match rates for channel {{name}}', {
              name: props.row.name,
            })}
          />
        }
      >
        <FileText data-icon='inline-start' aria-hidden='true' />
        {t('Report')}
      </PopoverTrigger>
      <PopoverContent className='w-[min(22rem,calc(100vw-2rem))]' align='end'>
        <PopoverHeader>
          <PopoverTitle>
            #{props.row.id} {props.row.name}
          </PopoverTitle>
          {latest && (
            <PopoverDescription className='tabular-nums'>
              {formatTimeRange(latest.started_at, latest.finished_at)}
            </PopoverDescription>
          )}
        </PopoverHeader>
        {models.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t('No model was detected in the latest run.')}
          </p>
        ) : (
          <ul className='flex flex-col gap-1.5'>
            {models.map((stat) => (
              <li
                key={stat.model}
                className='flex min-w-0 items-center justify-between gap-3 text-sm'
              >
                <span className='min-w-0 truncate font-mono text-xs'>
                  {stat.model}
                </span>
                <span className='flex shrink-0 items-center gap-2'>
                  <span className='font-medium tabular-nums'>
                    {formatPercent(stat.match_percent)}
                  </span>
                  <VerdictBadge verdict={stat.verdict} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
