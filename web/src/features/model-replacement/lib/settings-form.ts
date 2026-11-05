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
import * as z from 'zod'

import type {
  DetectedModelSetting,
  MatchMode,
  ModelReplacementSettings,
} from '../types'
import {
  ACTION_DEFINITIONS,
  ACTION_LIMIT_PARAMS,
  MAX_ACTIONS,
  validateAction,
} from './actions'

// Mirrors the bounds enforced by setting/operation_setting/model_replacement_setting.go.
export const SETTING_LIMITS = {
  intervalMinutesMax: 7 * 24 * 60,
  roundsMax: 50,
  concurrencyMax: 32,
  timeoutSecondsMax: 600,
  retryTimesMax: 10,
  textMax: 4000,
} as const

export const DEFAULT_RETRY_TIMES = 2

export const DEFAULT_MODEL_REPLACEMENT_SETTINGS: ModelReplacementSettings = {
  enabled: false,
  interval_minutes: 10,
  rounds: 3,
  concurrency: 3,
  timeout_seconds: 60,
  threshold: 0,
  pass_actions: [],
  fail_actions: [],
  models: [],
}

export const MATCH_MODES: readonly MatchMode[] = ['exact', 'contains', 'regex']

export function createDetectedModel(model: string): DetectedModelSetting {
  return {
    model,
    question: '',
    expected_answer: '',
    match_mode: 'exact',
    retry_times: DEFAULT_RETRY_TIMES,
    excluded_channel_ids: [],
  }
}

/**
 * Returns the excluded channel list after checking (including) or unchecking
 * (excluding) one channel. Exclusions are stored so that channels added later
 * are detected by default.
 */
export function setChannelIncluded(
  excludedChannelIds: number[],
  channelId: number,
  included: boolean
): number[] {
  const rest = excludedChannelIds.filter((id) => id !== channelId)
  if (included) return rest
  return [...rest, channelId].sort((a, b) => a - b)
}

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string

export function createModelReplacementSettingsSchema(t: Translate) {
  const integerInRange = (min: number, max: number, message: string) =>
    z.number().int(message).min(min, message).max(max, message)

  const detectedModelSchema = z.object({
    model: z.string().trim().min(1),
    question: z
      .string()
      .trim()
      .min(1, t('Enter a test question'))
      .max(SETTING_LIMITS.textMax),
    expected_answer: z
      .string()
      .trim()
      .min(1, t('Enter the expected answer'))
      .max(SETTING_LIMITS.textMax),
    match_mode: z.enum(['exact', 'contains', 'regex']),
    retry_times: integerInRange(
      0,
      SETTING_LIMITS.retryTimesMax,
      t('Enter an integer between {{min}} and {{max}}', {
        min: 0,
        max: SETTING_LIMITS.retryTimesMax,
      })
    ),
    excluded_channel_ids: z.array(z.number().int()),
  })

  const actionTypes = Object.keys(ACTION_DEFINITIONS) as [
    keyof typeof ACTION_DEFINITIONS,
    ...(keyof typeof ACTION_DEFINITIONS)[],
  ]
  const actionListSchema = z
    .array(
      z.object({
        type: z.enum(actionTypes),
        value: z.string(),
        amount: z.number(),
      })
    )
    .max(
      MAX_ACTIONS,
      t('At most {{max}} actions can be configured for each result', {
        max: MAX_ACTIONS,
      })
    )

  return z
    .object({
      enabled: z.boolean(),
      interval_minutes: integerInRange(
        1,
        SETTING_LIMITS.intervalMinutesMax,
        t('Enter an integer between {{min}} and {{max}}', {
          min: 1,
          max: SETTING_LIMITS.intervalMinutesMax,
        })
      ),
      rounds: integerInRange(
        1,
        SETTING_LIMITS.roundsMax,
        t('Enter an integer between {{min}} and {{max}}', {
          min: 1,
          max: SETTING_LIMITS.roundsMax,
        })
      ),
      concurrency: integerInRange(
        1,
        SETTING_LIMITS.concurrencyMax,
        t('Enter an integer between {{min}} and {{max}}', {
          min: 1,
          max: SETTING_LIMITS.concurrencyMax,
        })
      ),
      timeout_seconds: integerInRange(
        1,
        SETTING_LIMITS.timeoutSecondsMax,
        t('Enter an integer between {{min}} and {{max}}', {
          min: 1,
          max: SETTING_LIMITS.timeoutSecondsMax,
        })
      ),
      threshold: z
        .number()
        .min(0, t('Enter a number between 0 and 100'))
        .max(100, t('Enter a number between 0 and 100')),
      pass_actions: actionListSchema,
      fail_actions: actionListSchema,
      models: z.array(detectedModelSchema),
    })
    .superRefine((values, ctx) => {
      for (const key of ['pass_actions', 'fail_actions'] as const) {
        const invalid = values[key].findIndex((action) =>
          validateAction(action)
        )
        if (invalid >= 0) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: t('Action {{index}}: {{error}}', {
              index: invalid + 1,
              error: t(
                validateAction(values[key][invalid]) ?? '',
                ACTION_LIMIT_PARAMS
              ),
            }),
          })
        }
      }
      values.models.forEach((item, index) => {
        if (
          item.match_mode === 'regex' &&
          !isValidRegex(item.expected_answer)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['models', index, 'expected_answer'],
            message: t('Enter a valid regular expression'),
          })
        }
      })
    })
}
