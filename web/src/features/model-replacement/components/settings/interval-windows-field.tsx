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
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useFormState, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { safeNumberFieldProps } from '@/features/system-settings/utils/numeric-field'

import { MAX_INTERVAL_WINDOWS, SETTING_LIMITS } from '../../lib/settings-form'
import type { ModelReplacementSettings } from '../../types'

type IntervalWindowsFieldProps = {
  control: Control<ModelReplacementSettings>
  serverTimeZone: string
  /** Interval a new window starts with. */
  defaultInterval: number
}

/**
 * Time-of-day overrides of the detection interval. After each run, the
 * window containing the finish time decides how long to wait.
 */
export function IntervalWindowsField(props: IntervalWindowsFieldProps) {
  const { t } = useTranslation()
  const windows = useFieldArray({
    control: props.control,
    name: 'interval_windows',
    keyName: 'fieldKey',
  })
  const { errors } = useFormState({
    control: props.control,
    name: 'interval_windows',
  })
  const listError =
    errors.interval_windows?.root?.message ?? errors.interval_windows?.message

  return (
    <section
      aria-label={t('Interval by time of day')}
      data-settings-form-span='full'
      className='flex min-w-0 flex-col gap-3 rounded-lg border p-4'
    >
      <div className='space-y-0.5'>
        <h5 className='text-sm font-medium'>{t('Interval by time of day')}</h5>
        <p className='text-muted-foreground text-xs'>
          {t(
            'After each run, the window containing its finish time sets the wait before the next run; outside every window the default interval applies. Windows must not overlap, and an end earlier than the start runs past midnight (07:00-00:00 covers 07:00 to midnight).'
          )}
        </p>
        {props.serverTimeZone && (
          <p className='text-muted-foreground text-xs'>
            {t('Times use the server time zone: {{zone}}', {
              zone: props.serverTimeZone,
            })}
          </p>
        )}
      </div>
      {windows.fields.length > 0 && (
        <ol className='flex flex-col gap-2' aria-label={t('Time windows')}>
          {windows.fields.map((field, index) => (
            <li
              key={field.fieldKey}
              className='grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'
            >
              <FormField
                control={props.control}
                name={`interval_windows.${index}.start`}
                render={({ field: input }) => (
                  <FormItem>
                    <FormLabel className='text-xs'>{t('Start time')}</FormLabel>
                    <FormControl>
                      <Input type='time' step={60} {...input} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={props.control}
                name={`interval_windows.${index}.end`}
                render={({ field: input }) => (
                  <FormItem>
                    <FormLabel className='text-xs'>{t('End time')}</FormLabel>
                    <FormControl>
                      <Input type='time' step={60} {...input} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={props.control}
                name={`interval_windows.${index}.interval_minutes`}
                render={({ field: input }) => (
                  <FormItem>
                    <FormLabel className='text-xs'>
                      {t('Interval (minutes)')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        max={SETTING_LIMITS.intervalMinutesMax}
                        step={1}
                        {...safeNumberFieldProps(input)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                className='sm:mt-6'
                aria-label={t('Remove time window {{index}}', {
                  index: index + 1,
                })}
                onClick={() => windows.remove(index)}
              >
                <Trash2 aria-hidden='true' />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {listError && (
        <p className='text-destructive text-xs' role='alert'>
          {listError}
        </p>
      )}
      <Button
        type='button'
        variant='outline'
        size='sm'
        className='self-start'
        disabled={windows.fields.length >= MAX_INTERVAL_WINDOWS}
        onClick={() =>
          windows.append({
            start: '00:00',
            end: '07:00',
            interval_minutes: props.defaultInterval,
          })
        }
      >
        <Plus data-icon='inline-start' aria-hidden='true' />
        {t('Add time window')}
      </Button>
    </section>
  )
}
