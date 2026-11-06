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
import { describe, expect, it } from 'vitest'

import { HealthChannelTabs } from '../components/report/health-channel-tabs'
import type { DetectionChannelRow, DetectionRecord, Verdict } from '../types'

function channel(
  id: number,
  name: string,
  verdict: Verdict,
  inScope: boolean
): DetectionChannelRow {
  const latest: DetectionRecord = {
    id: id * 10,
    run_id: 'run-1',
    channel_id: id,
    channel_name: name,
    verdict,
    match_percent: verdict === 'passed' ? 100 : 0,
    actions: [],
    error_message: '',
    avg_latency_ms: 500,
    started_at: 1_700_000_000,
    finished_at: 1_700_000_030,
    created_at: 1_700_000_031,
    models: [],
  }
  return {
    id,
    name,
    type: 1,
    status: 1,
    groups: ['default'],
    in_scope: inScope,
    latest,
  }
}

const rows = [
  channel(1, 'steady', 'passed', true),
  channel(2, 'retired', 'passed', false),
  channel(3, 'swapped', 'replaced', true),
]

describe('HealthChannelTabs', () => {
  it('leaves channels no longer in detection scope out of the lists and counts by default', () => {
    render(<HealthChannelTabs rows={rows} />)

    expect(
      screen.getByRole('checkbox', {
        name: 'Hide channels no longer in detection scope',
      })
    ).toBeChecked()
    expect(
      screen.getByRole('tab', { name: 'Healthy channels (1)' })
    ).toBeInTheDocument()
    expect(screen.getByText('steady')).toBeInTheDocument()
    expect(screen.queryByText('retired')).not.toBeInTheDocument()
  })

  it('lists and counts channels no longer in detection scope once the hide option is cleared', async () => {
    const user = userEvent.setup()
    render(<HealthChannelTabs rows={rows} />)

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Hide channels no longer in detection scope',
      })
    )

    expect(
      screen.getByRole('tab', { name: 'Healthy channels (2)' })
    ).toBeInTheDocument()
    expect(screen.getByText('retired')).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Abnormal channels (1)' })
    ).toBeInTheDocument()
  })
})
