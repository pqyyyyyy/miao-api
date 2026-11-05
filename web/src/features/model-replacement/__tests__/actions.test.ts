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
import { describe, expect, it } from 'vitest'

import {
  ROUTING_LIMIT,
  createAction,
  describeAction,
  validateAction,
} from '../lib/actions'
import type { DetectionAction } from '../types'

const t = (key: string, options?: Record<string, unknown>) =>
  key.replaceAll(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name]))

describe('createAction', () => {
  it('starts amount actions at 1 and set actions at 0', () => {
    expect(createAction('increase_weight')).toEqual({
      type: 'increase_weight',
      value: '',
      amount: 1,
    })
    expect(createAction('set_priority').amount).toBe(0)
  })
})

describe('validateAction', () => {
  it.each<[string, DetectionAction, string | null]>([
    [
      'group required',
      { type: 'add_group', value: ' ', amount: 0 },
      'Group names cannot be empty, contain commas, or exceed 64 characters',
    ],
    [
      'group without comma',
      { type: 'remove_group', value: 'a,b', amount: 0 },
      'Group names cannot be empty, contain commas, or exceed 64 characters',
    ],
    [
      'tag required to set',
      { type: 'set_tag', value: '', amount: 0 },
      'Tags cannot be empty or exceed 64 characters',
    ],
    [
      'any tag may be removed',
      { type: 'remove_tag', value: '', amount: 0 },
      null,
    ],
    [
      'amount at least 1',
      { type: 'decrease_priority', value: '', amount: 0 },
      'Amounts must be between 1 and {{max}}',
    ],
    [
      'empty number',
      { type: 'increase_weight', value: '', amount: Number.NaN },
      'Amounts must be between 1 and {{max}}',
    ],
    [
      'negative priority allowed',
      { type: 'set_priority', value: '', amount: -5 },
      null,
    ],
    [
      'priority bounded',
      { type: 'set_priority', value: '', amount: ROUTING_LIMIT + 1 },
      'Priority must be between {{min}} and {{max}}',
    ],
    [
      'weight not negative',
      { type: 'set_weight', value: '', amount: -1 },
      'Weight must be between 0 and {{max}}',
    ],
    [
      'status needs nothing',
      { type: 'manual_disable', value: '', amount: 0 },
      null,
    ],
  ])('%s', (_, action, expected) => {
    expect(validateAction(action)).toBe(expected)
  })
})

describe('describeAction', () => {
  it('names the parameter of each kind of action', () => {
    expect(
      describeAction({ type: 'add_group', value: 'healthy', amount: 0 }, t)
    ).toBe('Add to group healthy')
    expect(
      describeAction({ type: 'decrease_priority', value: '', amount: 10 }, t)
    ).toBe('Decrease priority by 10')
    expect(
      describeAction({ type: 'set_weight', value: '', amount: 0 }, t)
    ).toBe('Set weight to 0')
    expect(
      describeAction({ type: 'remove_tag', value: '', amount: 0 }, t)
    ).toBe('Remove the tag')
    expect(
      describeAction({ type: 'remove_tag', value: 'slow', amount: 0 }, t)
    ).toBe('Remove tag slow')
  })
})
