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
import { useTranslation } from 'react-i18next'

import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import {
  CHANNEL_STATUS,
  CHANNEL_STATUS_CONFIG,
} from '@/features/channels/constants'

import type { Verdict } from '../../types'

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; variant: StatusVariant }
> = {
  passed: { label: 'Passed', variant: 'success' },
  replaced: { label: 'Suspected replacement', variant: 'danger' },
  failed: { label: 'Request failed', variant: 'warning' },
}

export function VerdictBadge(props: { verdict: Verdict | null | '' }) {
  const { t } = useTranslation()
  if (!props.verdict) {
    return <span className='text-muted-foreground'>-</span>
  }
  const config = VERDICT_CONFIG[props.verdict]
  return (
    <StatusBadge
      label={t(config.label)}
      variant={config.variant}
      size='sm'
      copyable={false}
    />
  )
}

export function ChannelStatusBadge(props: { status: number }) {
  const { t } = useTranslation()
  const config =
    CHANNEL_STATUS_CONFIG[props.status as keyof typeof CHANNEL_STATUS_CONFIG] ??
    CHANNEL_STATUS_CONFIG[CHANNEL_STATUS.UNKNOWN]
  return (
    <StatusBadge
      label={t(config.label)}
      variant={config.variant}
      size='sm'
      copyable={false}
    />
  )
}
