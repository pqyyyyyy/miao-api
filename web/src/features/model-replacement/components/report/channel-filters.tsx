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
import { Search, X } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type {
  ChannelStatusFilter,
  ChannelSummaryFilter,
} from '../../lib/report'

const STATUS_OPTIONS: { value: ChannelStatusFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'All statuses' },
  { value: 'healthy', labelKey: 'Healthy channels' },
  { value: 'abnormal', labelKey: 'Abnormal channels' },
  { value: 'auto_disabled', labelKey: 'Auto Disabled' },
]

type HideOutOfScopeCheckboxProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/** Toggles channels that were detected before but are no longer in scope. */
export function HideOutOfScopeCheckbox(props: HideOutOfScopeCheckboxProps) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className='flex items-center gap-2'>
      <Checkbox
        id={id}
        checked={props.checked}
        onCheckedChange={(checked) => props.onCheckedChange(checked)}
      />
      <Label htmlFor={id} className='font-normal'>
        {t('Hide channels no longer in detection scope')}
      </Label>
    </div>
  )
}

type ChannelSummaryFiltersProps = {
  value: ChannelSummaryFilter
  onChange: (value: ChannelSummaryFilter) => void
}

export function ChannelSummaryFilters(props: ChannelSummaryFiltersProps) {
  const { t } = useTranslation()
  const statusItems = STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }))

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center'>
      <InputGroup className='w-full sm:w-56'>
        <InputGroupAddon>
          <Search aria-hidden='true' />
        </InputGroupAddon>
        <InputGroupInput
          value={props.value.channelId}
          inputMode='numeric'
          onChange={(event) =>
            props.onChange({ ...props.value, channelId: event.target.value })
          }
          aria-label={t('Search by channel ID')}
          placeholder={t('Search by channel ID')}
        />
        {props.value.channelId && (
          <InputGroupAddon align='inline-end'>
            <InputGroupButton
              size='icon-xs'
              aria-label={t('Clear search')}
              onClick={() => props.onChange({ ...props.value, channelId: '' })}
            >
              <X aria-hidden='true' />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      <Select
        items={statusItems}
        value={props.value.status}
        onValueChange={(status) =>
          props.onChange({
            ...props.value,
            status: (status as ChannelStatusFilter | null) ?? 'all',
          })
        }
      >
        <SelectTrigger
          className='w-full sm:w-44'
          aria-label={t('Filter by status')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {statusItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <HideOutOfScopeCheckbox
        checked={props.value.hideOutOfScope}
        onCheckedChange={(hideOutOfScope) =>
          props.onChange({ ...props.value, hideOutOfScope })
        }
      />
    </div>
  )
}
