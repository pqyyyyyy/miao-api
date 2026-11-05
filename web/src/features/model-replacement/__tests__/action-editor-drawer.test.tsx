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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ActionListField } from '../components/settings/action-list-field'
import type { DetectionAction } from '../types'

function renderField(value: DetectionAction[] = []) {
  const onChange = vi.fn()
  render(
    <ActionListField
      title='When detection fails'
      description='Runs on failing channels.'
      value={value}
      onChange={onChange}
      groups={['default', 'healthy']}
    />
  )
  return onChange
}

async function addAction(
  user: ReturnType<typeof userEvent.setup>,
  label: string
) {
  await user.click(screen.getByRole('button', { name: 'Add action' }))
  await user.click(await screen.findByRole('menuitem', { name: label }))
}

describe('ActionListField drawer', () => {
  it('builds a sequence from the add menu and commits it in order', async () => {
    const user = userEvent.setup()
    const onChange = renderField()

    await user.click(screen.getByRole('button', { name: 'Edit actions (0)' }))
    await addAction(user, 'Decrease channel priority')
    await addAction(user, 'Set tag')
    const tagInput = screen.getByLabelText('Tag')
    await user.type(tagInput, ' suspect ')
    await user.click(screen.getByRole('button', { name: 'Move Set tag up' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))

    expect(onChange).toHaveBeenCalledWith([
      { type: 'set_tag', value: 'suspect', amount: 0 },
      { type: 'decrease_priority', value: '', amount: 1 },
    ])
  })

  it('keeps the drawer open and shows the problem when an action is incomplete', async () => {
    const user = userEvent.setup()
    const onChange = renderField()

    await user.click(screen.getByRole('button', { name: 'Edit actions (0)' }))
    await addAction(user, 'Set tag')
    await user.click(screen.getByRole('button', { name: 'Done' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tags cannot be empty or exceed 64 characters'
    )
    expect(screen.getByLabelText('Tag')).toHaveAttribute('aria-invalid', 'true')
  })

  it('discards the draft when the drawer is cancelled', async () => {
    const user = userEvent.setup()
    const onChange = renderField([
      { type: 'auto_disable', value: '', amount: 0 },
    ])

    await user.click(screen.getByRole('button', { name: 'Edit actions (1)' }))
    const steps = screen.getByRole('list', { name: 'When detection fails' })
    await user.click(
      within(steps).getByRole('button', { name: 'Remove Set to auto-disabled' })
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Set to auto-disabled')).toBeInTheDocument()
  })
})
