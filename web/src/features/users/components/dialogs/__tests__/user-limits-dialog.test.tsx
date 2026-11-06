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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import type { UsageRuleStatus, UserLimits } from '@/lib/usage-limits'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { UserLimitsDialog } from '../user-limits-dialog'

const exhaustedFiveHours: UsageRuleStatus = {
  window_seconds: 18000,
  quota_limit: 5_000_000,
  enabled: true,
  status: 'exhausted',
  used_quota: 5_000_000,
  window_start: 1_700_000_000,
  reset_at: 1_700_018_000,
}

const savedLimits: UserLimits = {
  max_concurrency: 2,
  current_concurrency: 1,
  updated_at: 1_700_000_000,
  usage_rules: [exhaustedFiveHours],
}

const queryClients: QueryClient[] = []

function renderDialog() {
  const onOpenChange = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  queryClients.push(client)
  render(
    <QueryClientProvider client={client}>
      <UserLimitsDialog
        open
        onOpenChange={onOpenChange}
        user={{ id: 7, username: 'alice' }}
      />
    </QueryClientProvider>
  )
  return { onOpenChange }
}

function mockLoad(limits: UserLimits = savedLimits) {
  return vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, data: limits } })
}

beforeEach(() => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})
afterEach(() => {
  queryClients.splice(0).forEach((client) => client.clear())
})

describe('UserLimitsDialog', () => {
  it('loads the saved policy and shows the current window of each saved rule', async () => {
    const get = mockLoad()

    renderDialog()

    expect(await screen.findByLabelText('Maximum concurrency')).toHaveValue(2)
    expect(get).toHaveBeenCalledWith('/api/user/7/limits')
    expect(screen.getByText('In flight now: 1')).toBeInTheDocument()
    const rules = screen.getByRole('list', { name: 'Usage limit rules' })
    expect(within(rules).getAllByRole('listitem')).toHaveLength(1)
    expect(within(rules).getByText('Exhausted')).toBeInTheDocument()
    expect(
      within(rules).getByRole('progressbar', {
        name: 'Usage limit used: 100%',
      })
    ).toBeInTheDocument()
  })

  it('saves an added rule as window seconds and quota units, then closes', async () => {
    mockLoad()
    const put = vi.spyOn(api, 'put').mockResolvedValue({
      data: { success: true, data: savedLimits },
    })
    const { onOpenChange } = renderDialog()
    await screen.findByLabelText('Maximum concurrency')

    // The new rule takes the first preset window not used yet: 1 day.
    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }))
    const amounts = screen.getAllByLabelText('Quota (USD)')
    fireEvent.change(amounts[1], { target: { value: '3' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/user/7/limits', {
        max_concurrency: 2,
        usage_rules: [
          { window_seconds: 18000, quota_limit: 5_000_000, enabled: true },
          { window_seconds: 86400, quota_limit: 1_500_000, enabled: true },
        ],
      })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps the sheet open and shows the field error for a rule without an amount', async () => {
    mockLoad()
    const put = vi.spyOn(api, 'put')
    const { onOpenChange } = renderDialog()
    await screen.findByLabelText('Maximum concurrency')

    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('Amount must be greater than 0')
    ).toBeInTheDocument()
    expect(put).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('ends a window after confirmation and shows it as not started', async () => {
    mockLoad()
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          ...savedLimits,
          usage_rules: [
            {
              ...exhaustedFiveHours,
              status: 'idle',
              used_quota: 0,
              window_start: 0,
              reset_at: 0,
            },
          ],
        },
      },
    })
    renderDialog()
    await screen.findByLabelText('Maximum concurrency')

    await userEvent.click(screen.getByRole('button', { name: 'End window' }))
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(
      within(confirm).getByRole('button', { name: 'End window' })
    )

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/user/7/limits/reset', {
        window_seconds: 18000,
      })
    )
    expect(await screen.findByText('Not started')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'End window' })).toBeDisabled()
  })

  it('offers a retry when the policy cannot be loaded', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue({ data: { success: true, data: savedLimits } })
    renderDialog()

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(await screen.findByLabelText('Maximum concurrency')).toHaveValue(2)
    expect(get).toHaveBeenCalledTimes(2)
  })
})
