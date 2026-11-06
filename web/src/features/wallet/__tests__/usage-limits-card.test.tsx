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
import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import type { UserLimits } from '@/lib/usage-limits'

import { UsageLimitsCard } from '../components/usage-limits-card'

const queryClients: QueryClient[] = []

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  queryClients.push(client)
  const view = render(
    <QueryClientProvider client={client}>
      <UsageLimitsCard />
    </QueryClientProvider>
  )
  return { client, container: view.container }
}

afterEach(() => {
  queryClients.splice(0).forEach((client) => client.clear())
})

describe('UsageLimitsCard', () => {
  it('renders nothing for a user without limits', async () => {
    const noLimits: UserLimits = {
      max_concurrency: 0,
      current_concurrency: 0,
      usage_rules: [],
      updated_at: 0,
    }
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: noLimits },
    })
    const { client, container } = renderCard()

    await waitFor(() =>
      expect(client.getQueryState(['self-limits'])?.status).toBe('success')
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows each rule window with its state and the concurrency cap', async () => {
    const limits: UserLimits = {
      max_concurrency: 4,
      current_concurrency: 1,
      updated_at: 0,
      usage_rules: [
        {
          window_seconds: 18000,
          quota_limit: 1_000_000,
          enabled: true,
          status: 'active',
          used_quota: 250_000,
          window_start: 1_700_000_000,
          reset_at: 1_700_018_000,
        },
        {
          window_seconds: 604800,
          quota_limit: 5_000_000,
          enabled: true,
          status: 'idle',
          used_quota: 0,
          window_start: 0,
          reset_at: 0,
        },
      ],
    }
    const get = vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: limits },
    })
    renderCard()

    const rules = await screen.findByRole('list', {
      name: 'Usage limit rules',
    })
    expect(get).toHaveBeenCalledWith('/api/user/self/limits')
    const [fiveHours, sevenDays] = within(rules).getAllByRole('listitem')
    expect(within(fiveHours).getByText('5 hours')).toBeInTheDocument()
    expect(within(fiveHours).getByText('In progress')).toBeInTheDocument()
    expect(
      within(fiveHours).getByRole('progressbar', {
        name: 'Usage limit used: 25%',
      })
    ).toBeInTheDocument()
    expect(within(sevenDays).getByText('7 days')).toBeInTheDocument()
    expect(
      within(sevenDays).getByText('Starts with the next charged request')
    ).toBeInTheDocument()
    expect(screen.getByText('Concurrent requests: 1 / 4')).toBeInTheDocument()
  })

  it('renders nothing when the limits cannot be loaded', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('network down'))
    const { client, container } = renderCard()

    await waitFor(() =>
      expect(client.getQueryState(['self-limits'])?.status).toBe('error')
    )
    expect(container).toBeEmptyDOMElement()
  })
})
