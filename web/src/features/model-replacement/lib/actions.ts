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
import type { ActionType, DetectionAction } from '../types'

// Mirrors setting/operation_setting/model_replacement_setting.go.
export const MAX_ACTIONS = 20
export const ROUTING_LIMIT = 2147483647
const MAX_NAME_LENGTH = 64

/** Which parameter an action takes. */
export type ActionParam =
  | 'group'
  | 'tag'
  | 'optional-tag'
  | 'amount'
  | 'priority'
  | 'weight'
  | 'none'

export type ActionCategory = 'group' | 'priority' | 'weight' | 'status' | 'tag'

type ActionDefinition = {
  label: string
  param: ActionParam
  category: ActionCategory
}

export const ACTION_DEFINITIONS: Record<ActionType, ActionDefinition> = {
  add_group: { label: 'Add to group', param: 'group', category: 'group' },
  remove_group: {
    label: 'Remove from group (if present)',
    param: 'group',
    category: 'group',
  },
  increase_priority: {
    label: 'Increase channel priority',
    param: 'amount',
    category: 'priority',
  },
  decrease_priority: {
    label: 'Decrease channel priority',
    param: 'amount',
    category: 'priority',
  },
  set_priority: {
    label: 'Set channel priority',
    param: 'priority',
    category: 'priority',
  },
  increase_weight: {
    label: 'Increase channel weight',
    param: 'amount',
    category: 'weight',
  },
  decrease_weight: {
    label: 'Decrease channel weight',
    param: 'amount',
    category: 'weight',
  },
  set_weight: {
    label: 'Set channel weight',
    param: 'weight',
    category: 'weight',
  },
  auto_disable: {
    label: 'Set to auto-disabled',
    param: 'none',
    category: 'status',
  },
  manual_disable: {
    label: 'Set to disabled',
    param: 'none',
    category: 'status',
  },
  set_tag: { label: 'Set tag', param: 'tag', category: 'tag' },
  remove_tag: {
    label: 'Remove tag (if present)',
    param: 'optional-tag',
    category: 'tag',
  },
}

/** Add-action menu sections, in display order. */
export const ACTION_CATEGORIES: {
  id: ActionCategory
  label: string
  types: ActionType[]
}[] = [
  { id: 'group', label: 'Groups', types: ['add_group', 'remove_group'] },
  {
    id: 'priority',
    label: 'Priority',
    types: ['increase_priority', 'decrease_priority', 'set_priority'],
  },
  {
    id: 'weight',
    label: 'Weight',
    types: ['increase_weight', 'decrease_weight', 'set_weight'],
  },
  { id: 'status', label: 'Status', types: ['auto_disable', 'manual_disable'] },
  { id: 'tag', label: 'Tag', types: ['set_tag', 'remove_tag'] },
]

export function createAction(type: ActionType): DetectionAction {
  const param = ACTION_DEFINITIONS[type].param
  return { type, value: '', amount: param === 'amount' ? 1 : 0 }
}

/**
 * Returns the i18n key of the problem with an action, or null when it is
 * valid. The server applies the same rules.
 */
export function validateAction(action: DetectionAction): string | null {
  const definition = ACTION_DEFINITIONS[action.type]
  if (!definition) return 'Unknown detection action'
  const value = action.value.trim()
  const amount = action.amount
  switch (definition.param) {
    case 'group':
      if (!value || value.includes(',') || value.length > MAX_NAME_LENGTH) {
        return 'Group names cannot be empty, contain commas, or exceed 64 characters'
      }
      return null
    case 'tag':
    case 'optional-tag':
      if (
        (definition.param === 'tag' && !value) ||
        value.length > MAX_NAME_LENGTH
      ) {
        return 'Tags cannot be empty or exceed 64 characters'
      }
      return null
    case 'amount':
      if (!Number.isInteger(amount) || amount < 1 || amount > ROUTING_LIMIT) {
        return 'Amounts must be between 1 and {{max}}'
      }
      return null
    case 'priority':
      if (!Number.isInteger(amount) || Math.abs(amount) > ROUTING_LIMIT) {
        return 'Priority must be between {{min}} and {{max}}'
      }
      return null
    case 'weight':
      if (!Number.isInteger(amount) || amount < 0 || amount > ROUTING_LIMIT) {
        return 'Weight must be between 0 and {{max}}'
      }
      return null
    default:
      return null
  }
}

/** Interpolation values used with the messages from {@link validateAction}. */
export const ACTION_LIMIT_PARAMS = { min: -ROUTING_LIMIT, max: ROUTING_LIMIT }

type Translate = (key: string, options?: Record<string, unknown>) => string

/** One-line description of a configured or applied action. */
export function describeAction(action: DetectionAction, t: Translate): string {
  const value = action.value.trim()
  const amount = action.amount
  switch (action.type) {
    case 'add_group':
      return t('Add to group {{group}}', { group: value })
    case 'remove_group':
      return t('Remove from group {{group}}', { group: value })
    case 'increase_priority':
      return t('Increase priority by {{amount}}', { amount })
    case 'decrease_priority':
      return t('Decrease priority by {{amount}}', { amount })
    case 'set_priority':
      return t('Set priority to {{amount}}', { amount })
    case 'increase_weight':
      return t('Increase weight by {{amount}}', { amount })
    case 'decrease_weight':
      return t('Decrease weight by {{amount}}', { amount })
    case 'set_weight':
      return t('Set weight to {{amount}}', { amount })
    case 'auto_disable':
      return t('Set to auto-disabled')
    case 'manual_disable':
      return t('Set to disabled')
    case 'set_tag':
      return t('Set tag to {{tag}}', { tag: value })
    case 'remove_tag':
      return value
        ? t('Remove tag {{tag}}', { tag: value })
        : t('Remove the tag')
    default:
      return action.type
  }
}
