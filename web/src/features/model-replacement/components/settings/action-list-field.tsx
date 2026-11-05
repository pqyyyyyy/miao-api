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
import { Workflow } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { describeAction } from '../../lib/actions'
import type { DetectionAction } from '../../types'
import { ActionEditorDrawer } from './action-editor-drawer'
import { ACTION_ICONS } from './action-icons'

type ActionListFieldProps = {
  title: string
  description: string
  value: DetectionAction[]
  onChange: (actions: DetectionAction[]) => void
  groups: string[]
  error?: string
}

/** Summary of one action list with a button that opens its editor drawer. */
export function ActionListField(props: ActionListFieldProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)

  return (
    <section
      aria-label={props.title}
      className='bg-card flex min-w-0 flex-col gap-3 rounded-lg border p-4'
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 space-y-0.5'>
          <h5 className='text-sm font-medium'>{props.title}</h5>
          <p className='text-muted-foreground text-xs'>{props.description}</p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => {
            setSession((current) => current + 1)
            setOpen(true)
          }}
        >
          <Workflow data-icon='inline-start' aria-hidden='true' />
          {t('Edit actions ({{count}})', { count: props.value.length })}
        </Button>
      </div>
      {props.value.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          {t('No actions. Channels are left unchanged.')}
        </p>
      ) : (
        <ol className='flex flex-col gap-1.5'>
          {props.value.map((action, index) => {
            const Icon = ACTION_ICONS[action.type]
            return (
              <li
                // Actions have no identity besides their position.
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className='flex min-w-0 items-center gap-2 text-sm'
              >
                <span className='bg-muted text-muted-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums'>
                  {index + 1}
                </span>
                <Icon
                  className='text-muted-foreground size-3.5 shrink-0'
                  aria-hidden='true'
                />
                <span className='min-w-0 truncate'>
                  {describeAction(action, t)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {props.error && (
        <p className='text-destructive text-xs' role='alert'>
          {props.error}
        </p>
      )}
      <ActionEditorDrawer
        open={open}
        onOpenChange={setOpen}
        session={session}
        title={props.title}
        description={props.description}
        actions={props.value}
        groups={props.groups}
        onSave={(actions) => {
          props.onChange(actions)
          setOpen(false)
        }}
      />
    </section>
  )
}
