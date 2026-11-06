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
import { Box, ScanSearch } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import type { NavGroup } from '@/components/layout/types'
import { ROLE } from '@/lib/roles'
import type { AuthUser } from '@/stores/auth-store'

import { filterNavGroupsForUser } from '../use-sidebar-view'

const groups: NavGroup[] = [
  {
    id: 'admin',
    title: 'Admin',
    items: [
      { title: 'Models', url: '/models/metadata', icon: Box },
      {
        title: 'Model replacement detection',
        url: '/model-replacement',
        icon: ScanSearch,
        requiredPermission: {
          resource: 'channel',
          action: 'model_replacement',
        },
      },
      {
        title: 'System Info',
        url: '/system-info',
        icon: Box,
        requiredRole: ROLE.SUPER_ADMIN,
      },
    ],
  },
]

function user(role: number, granted = false): AuthUser {
  return {
    id: 7,
    username: 'operator',
    role,
    permissions: granted
      ? { admin_permissions: { channel: { model_replacement: true } } }
      : { admin_permissions: { channel: { read: true } } },
  } as AuthUser
}

function visibleUrls(target: AuthUser | null) {
  return filterNavGroupsForUser(groups, target).flatMap((group) =>
    group.items.map((item) => ('url' in item ? item.url : item.title))
  )
}

describe('filterNavGroupsForUser', () => {
  it('hides a permission-gated item from an admin without the permission', () => {
    expect(visibleUrls(user(ROLE.ADMIN))).toEqual(['/models/metadata'])
  })

  it('shows a permission-gated item to an admin granted the permission', () => {
    expect(visibleUrls(user(ROLE.ADMIN, true))).toEqual([
      '/models/metadata',
      '/model-replacement',
    ])
  })

  it('shows every item to root', () => {
    expect(visibleUrls(user(ROLE.SUPER_ADMIN))).toEqual([
      '/models/metadata',
      '/model-replacement',
      '/system-info',
    ])
  })

  it('hides the admin group from a regular user even with a stray grant', () => {
    expect(visibleUrls(user(ROLE.USER, true))).toEqual([])
  })
})
