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

import { ChannelSummaryTable } from '../components/report/channel-summary-table'
import type { DetectionChannelRow, DetectionRecord } from '../types'

const latest: DetectionRecord = {
  id: 11,
  run_id: 'run-1',
  channel_id: 7,
  channel_name: 'upstream',
  verdict: 'replaced',
  match_percent: 50,
  actions: [],
  error_message: '',
  avg_latency_ms: 800,
  started_at: 1_700_000_000,
  finished_at: 1_700_000_030,
  created_at: 1_700_000_031,
  models: [
    {
      model: 'gpt-4o',
      total: 2,
      matched: 2,
      mismatched: 0,
      failed: 0,
      match_percent: 100,
      mismatch_percent: 0,
      verdict: 'passed',
    },
    {
      model: 'claude',
      total: 2,
      matched: 1,
      mismatched: 1,
      failed: 0,
      match_percent: 50,
      mismatch_percent: 50,
      verdict: 'replaced',
    },
  ],
}

const rows: DetectionChannelRow[] = [
  {
    id: 7,
    name: 'upstream',
    type: 1,
    status: 1,
    groups: ['default'],
    in_scope: true,
    latest,
  },
  {
    id: 8,
    name: 'fresh',
    type: 1,
    status: 1,
    groups: ['default'],
    in_scope: true,
    latest: null,
  },
]

describe('ChannelSummaryTable actions', () => {
  it('shows the match rate of every model in the report popover', async () => {
    const user = userEvent.setup()
    render(
      <ChannelSummaryTable rows={rows} model={null} onViewReport={vi.fn()} />
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Model match rates for channel upstream',
      })
    )

    const popover = await screen.findByRole('dialog')
    const items = within(popover).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^gpt-4o100%/),
      expect.stringMatching(/^claude50%/),
    ])
  })

  it('opens the chart for the channel from the details button', async () => {
    const user = userEvent.setup()
    const onViewReport = vi.fn()
    render(
      <ChannelSummaryTable
        rows={rows}
        model={null}
        onViewReport={onViewReport}
      />
    )

    await user.click(
      screen.getByRole('button', {
        name: 'View the detection chart for channel upstream',
      })
    )

    expect(onViewReport).toHaveBeenCalledWith(7)
  })

  it('disables both buttons for a channel that has not been detected', () => {
    render(
      <ChannelSummaryTable rows={rows} model={null} onViewReport={vi.fn()} />
    )

    expect(
      screen.getByRole('button', {
        name: 'Model match rates for channel fresh',
      })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'View the detection chart for channel fresh',
      })
    ).toBeDisabled()
  })
})

describe('ChannelSummaryTable filters', () => {
  const filterRows: DetectionChannelRow[] = [
    ...rows,
    {
      id: 9,
      name: 'retired',
      type: 1,
      status: 1,
      groups: ['default'],
      in_scope: false,
      latest: { ...latest, id: 12, channel_id: 9, channel_name: 'retired' },
    },
    {
      id: 10,
      name: 'paused',
      type: 1,
      status: 3,
      groups: ['default'],
      in_scope: true,
      latest: { ...latest, id: 13, channel_id: 10, channel_name: 'paused' },
    },
  ]

  it('hides a channel no longer in detection scope until the hide option is cleared', async () => {
    const user = userEvent.setup()
    render(
      <ChannelSummaryTable
        rows={filterRows}
        model={null}
        onViewReport={vi.fn()}
      />
    )
    const hide = screen.getByRole('checkbox', {
      name: 'Hide channels no longer in detection scope',
    })

    expect(hide).toBeChecked()
    expect(screen.queryByText('retired')).not.toBeInTheDocument()

    await user.click(hide)

    expect(hide).not.toBeChecked()
    expect(screen.getByText('retired')).toBeInTheDocument()
  })

  it('narrows the table to the typed channel ID', async () => {
    const user = userEvent.setup()
    render(
      <ChannelSummaryTable
        rows={filterRows}
        model={null}
        onViewReport={vi.fn()}
      />
    )

    await user.type(
      screen.getByRole('textbox', { name: 'Search by channel ID' }),
      '8'
    )

    expect(screen.getByText('fresh')).toBeInTheDocument()
    expect(screen.queryByText('upstream')).not.toBeInTheDocument()
    expect(screen.queryByText('paused')).not.toBeInTheDocument()
  })

  it('says that no channel matches when the filters exclude every channel', async () => {
    const user = userEvent.setup()
    render(
      <ChannelSummaryTable
        rows={filterRows}
        model={null}
        onViewReport={vi.fn()}
      />
    )

    await user.type(
      screen.getByRole('textbox', { name: 'Search by channel ID' }),
      '99'
    )

    expect(screen.getByText('No matching channels')).toBeInTheDocument()
  })

  it('keeps only auto-disabled channels after choosing that status', async () => {
    const user = userEvent.setup()
    render(
      <ChannelSummaryTable
        rows={filterRows}
        model={null}
        onViewReport={vi.fn()}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Filter by status' }))
    await user.click(
      await screen.findByRole('option', { name: 'Auto Disabled' })
    )

    expect(screen.getByText('paused')).toBeInTheDocument()
    expect(screen.queryByText('upstream')).not.toBeInTheDocument()
    expect(screen.queryByText('fresh')).not.toBeInTheDocument()
  })
})
