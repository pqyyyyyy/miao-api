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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { ModelReplacementSettingsDrawer } from '../components/settings/model-replacement-settings-drawer'
import { DEFAULT_MODEL_REPLACEMENT_SETTINGS } from '../lib/settings-form'

const settings = {
  ...DEFAULT_MODEL_REPLACEMENT_SETTINGS,
  enabled: true,
  interval_minutes: 15,
}

function renderDrawer(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ModelReplacementSettingsDrawer open onOpenChange={onOpenChange} />
    </QueryClientProvider>
  )
  return onOpenChange
}

describe('ModelReplacementSettingsDrawer', () => {
  beforeEach(() => {
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/api/model_replacement/settings') {
        return {
          data: {
            success: true,
            data: { settings, server_time_zone: 'UTC+08:00 (CST)' },
          },
        }
      }
      if (url === '/api/model_replacement/candidates') {
        return { data: { success: true, data: [] } }
      }
      return { data: { success: true, data: ['default'] } }
    })
    vi.spyOn(api, 'put').mockResolvedValue({
      data: { success: true, data: settings },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves from its own footer and closes after the save succeeds', async () => {
    const user = userEvent.setup()
    const onOpenChange = renderDrawer()

    const interval = await screen.findByLabelText(
      'Default detection interval (minutes)'
    )
    // Number inputs snap back when emptied, so type over the selected value.
    await user.tripleClick(interval)
    await user.keyboard('20')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        '/api/model_replacement/settings',
        expect.objectContaining({ enabled: true, interval_minutes: 20 })
      )
    )
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('shows the server time zone that time windows use', async () => {
    renderDrawer()

    expect(
      await screen.findByText('Times use the server time zone: UTC+08:00 (CST)')
    ).toBeInTheDocument()
  })
})
