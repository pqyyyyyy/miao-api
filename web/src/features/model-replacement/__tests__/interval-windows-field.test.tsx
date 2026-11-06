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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { Form } from '@/components/ui/form'

import { IntervalWindowsField } from '../components/settings/interval-windows-field'
import { DEFAULT_MODEL_REPLACEMENT_SETTINGS } from '../lib/settings-form'
import type { IntervalWindow, ModelReplacementSettings } from '../types'

let windows: IntervalWindow[] = []

function Harness(props: { initial?: IntervalWindow[] }) {
  const form = useForm<ModelReplacementSettings>({
    defaultValues: {
      ...DEFAULT_MODEL_REPLACEMENT_SETTINGS,
      interval_windows: props.initial ?? [],
    },
  })
  windows = form.watch('interval_windows')
  return (
    <Form {...form}>
      <IntervalWindowsField
        control={form.control}
        serverTimeZone='UTC+08:00 (CST)'
        defaultInterval={10}
      />
    </Form>
  )
}

describe('IntervalWindowsField', () => {
  it('adds a window that starts with the default interval and shows the server time zone', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(
      screen.getByText('Times use the server time zone: UTC+08:00 (CST)')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add time window' }))

    expect(windows).toEqual([
      { start: '00:00', end: '07:00', interval_minutes: 10 },
    ])
    expect(screen.getByLabelText('Start time')).toHaveValue('00:00')
    expect(screen.getByLabelText('Interval (minutes)')).toHaveValue(10)
  })

  it('removes the chosen window and keeps the others', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initial={[
          { start: '00:00', end: '07:00', interval_minutes: 60 },
          { start: '07:00', end: '00:00', interval_minutes: 30 },
        ]}
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Remove time window 1' })
    )

    expect(windows).toEqual([
      { start: '07:00', end: '00:00', interval_minutes: 30 },
    ])
  })
})
