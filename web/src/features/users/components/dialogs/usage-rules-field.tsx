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
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import {
  useFieldArray,
  useFormState,
  useWatch,
  type Control,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { SideDrawerSectionHeader } from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { UsageRuleProgress } from '@/components/usage-rule-progress'
import { safeNumberFieldProps } from '@/features/system-settings/utils/numeric-field'
import { getCurrencyLabel } from '@/lib/currency'
import { getEditableQuotaStep } from '@/lib/format'
import { formatUsageWindow, type UsageRuleStatus } from '@/lib/usage-limits'

import {
  CUSTOM_USAGE_WINDOW,
  MAX_USAGE_RULES,
  NEW_USAGE_RULE,
  USAGE_WINDOW_PRESETS,
  usageRuleWindowSeconds,
  type UserLimitsFormValues,
} from '../../lib/user-limits-form'

interface UsageRulesFieldProps {
  control: Control<UserLimitsFormValues>
  /** Saved rules with their current window, keyed by window length. */
  savedRules: Map<number, UsageRuleStatus>
  resetting: boolean
  onResetWindow: (windowSeconds: number) => void
}

/**
 * Editable list of usage limit rules. A row whose window length matches a
 * saved rule also shows that rule's current window.
 */
export function UsageRulesField(props: UsageRulesFieldProps) {
  const { t } = useTranslation()
  const rules = useFieldArray({
    control: props.control,
    name: 'usage_rules',
    keyName: 'fieldKey',
  })
  const values = useWatch({ control: props.control, name: 'usage_rules' })
  const { errors } = useFormState({
    control: props.control,
    name: 'usage_rules',
  })
  const listError =
    errors.usage_rules?.root?.message ?? errors.usage_rules?.message
  const windowItems = [
    ...USAGE_WINDOW_PRESETS.map((seconds) => ({
      value: String(seconds),
      label: formatUsageWindow(seconds, t),
    })),
    { value: CUSTOM_USAGE_WINDOW, label: t('Custom') },
  ]
  const unitItems = [
    { value: 'hours', label: t('hours') },
    { value: 'days', label: t('days') },
  ]

  return (
    <section
      aria-label={t('Usage limit rules')}
      className='flex min-w-0 flex-col gap-3'
    >
      <SideDrawerSectionHeader
        title={t('Usage limit rules')}
        description={t(
          'Each rule caps the quota this user can spend in a fixed window. A window starts with the first charged request and resets entirely when it ends; requests are rejected once it is used up.'
        )}
      />
      {rules.fields.length > 0 && (
        <ol className='flex flex-col gap-3' aria-label={t('Usage limit rules')}>
          {rules.fields.map((field, index) => {
            const current = values?.[index] ?? field
            const isCustom = current.window === CUSTOM_USAGE_WINDOW
            const saved = props.savedRules.get(usageRuleWindowSeconds(current))
            return (
              <li
                key={field.fieldKey}
                className='flex flex-col gap-3 rounded-lg border p-3'
              >
                <div className='grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]'>
                  <FormField
                    control={props.control}
                    name={`usage_rules.${index}.window`}
                    render={({ field: input }) => (
                      <FormItem>
                        <FormLabel className='text-xs'>
                          {t('Time window')}
                        </FormLabel>
                        <Select
                          items={windowItems}
                          value={input.value}
                          onValueChange={(value) =>
                            value !== null && input.onChange(value)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className='w-full'>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent alignItemWithTrigger={false}>
                            <SelectGroup>
                              {windowItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={props.control}
                    name={`usage_rules.${index}.quota_amount`}
                    render={({ field: input }) => (
                      <FormItem>
                        <FormLabel className='text-xs'>
                          {t('Quota ({{currency}})', {
                            currency: getCurrencyLabel(),
                          })}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0}
                            step={getEditableQuotaStep()}
                            {...safeNumberFieldProps(input)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={props.control}
                    name={`usage_rules.${index}.enabled`}
                    render={({ field: input }) => (
                      <FormItem>
                        <FormLabel className='text-xs'>
                          {t('Enabled')}
                        </FormLabel>
                        <FormControl>
                          <Switch
                            className='mt-2'
                            checked={input.value}
                            onCheckedChange={(checked) =>
                              input.onChange(!!checked)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    className='sm:mt-6'
                    aria-label={t('Remove usage limit rule {{index}}', {
                      index: index + 1,
                    })}
                    onClick={() => rules.remove(index)}
                  >
                    <Trash2 aria-hidden='true' />
                  </Button>
                </div>
                {isCustom && (
                  <div className='grid items-start gap-2 sm:grid-cols-2'>
                    <FormField
                      control={props.control}
                      name={`usage_rules.${index}.custom_amount`}
                      render={({ field: input }) => (
                        <FormItem>
                          <FormLabel className='text-xs'>
                            {t('Window length')}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type='number'
                              min={1}
                              step={1}
                              {...safeNumberFieldProps(input)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={props.control}
                      name={`usage_rules.${index}.custom_unit`}
                      render={({ field: input }) => (
                        <FormItem>
                          <FormLabel className='text-xs'>{t('Unit')}</FormLabel>
                          <Select
                            items={unitItems}
                            value={input.value}
                            onValueChange={(value) =>
                              value !== null && input.onChange(value)
                            }
                          >
                            <FormControl>
                              <SelectTrigger className='w-full'>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent alignItemWithTrigger={false}>
                              <SelectGroup>
                                {unitItems.map((item) => (
                                  <SelectItem
                                    key={item.value}
                                    value={item.value}
                                  >
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                {saved && (
                  <div className='flex flex-col gap-2 sm:flex-row sm:items-end'>
                    <UsageRuleProgress rule={saved} className='flex-1' />
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={props.resetting || saved.status === 'idle'}
                      onClick={() => props.onResetWindow(saved.window_seconds)}
                    >
                      <RotateCcw data-icon='inline-start' aria-hidden='true' />
                      {t('End window')}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
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
        disabled={rules.fields.length >= MAX_USAGE_RULES}
        onClick={() => {
          const usedWindows = new Set(
            (values ?? []).map(usageRuleWindowSeconds)
          )
          const freePreset = USAGE_WINDOW_PRESETS.find(
            (seconds) => !usedWindows.has(seconds)
          )
          rules.append({
            ...NEW_USAGE_RULE,
            window: freePreset ? String(freePreset) : CUSTOM_USAGE_WINDOW,
          })
        }}
      >
        <Plus data-icon='inline-start' aria-hidden='true' />
        {t('Add rule')}
      </Button>
    </section>
  )
}
