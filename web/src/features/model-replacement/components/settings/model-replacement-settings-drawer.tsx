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
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  sideDrawerContentClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getGroups } from '@/features/users/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import {
  getModelReplacementCandidates,
  getModelReplacementSettings,
  modelReplacementQueryKeys,
} from '../../api'
import { DEFAULT_MODEL_REPLACEMENT_SETTINGS } from '../../lib/settings-form'
import { ModelReplacementSettingsForm } from './model-replacement-settings-form'

type ModelReplacementSettingsDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Drawer on the report page that edits the detection settings, so an
 * administrator granted the detection permission can maintain it without
 * access to system settings.
 */
export function ModelReplacementSettingsDrawer(
  props: ModelReplacementSettingsDrawerProps
) {
  const { t } = useTranslation()
  const settingsQuery = useQuery({
    queryKey: modelReplacementQueryKeys.settings(),
    queryFn: async () =>
      requireServerSuccess(await getModelReplacementSettings()).data ?? {
        settings: DEFAULT_MODEL_REPLACEMENT_SETTINGS,
        server_time_zone: '',
      },
    enabled: props.open,
  })
  const candidatesQuery = useQuery({
    queryKey: modelReplacementQueryKeys.candidates(),
    queryFn: async () =>
      requireServerSuccess(await getModelReplacementCandidates()).data ?? [],
    enabled: props.open,
  })
  const groupsQuery = useQuery({
    queryKey: [...modelReplacementQueryKeys.all, 'groups'],
    queryFn: async () => requireServerSuccess(await getGroups()).data ?? [],
    enabled: props.open,
  })

  let body = <LoadingState className='flex-1' />
  if (settingsQuery.isError || candidatesQuery.isError) {
    body = (
      <ErrorState
        title={t('Failed to load settings')}
        onRetry={() => {
          void settingsQuery.refetch()
          void candidatesQuery.refetch()
        }}
      />
    )
  } else if (settingsQuery.data && candidatesQuery.data) {
    body = (
      <ModelReplacementSettingsForm
        settings={settingsQuery.data.settings}
        serverTimeZone={settingsQuery.data.server_time_zone}
        candidates={candidatesQuery.data}
        groups={groupsQuery.data ?? []}
        onSaved={() => props.onOpenChange(false)}
      />
    )
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        className={sideDrawerContentClassName('max-w-none sm:!max-w-[820px]')}
      >
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Detection settings')}</SheetTitle>
          <SheetDescription>
            {t(
              'Periodically asks each channel the configured questions and checks the answers to find channels that serve a different model.'
            )}
          </SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )
}
