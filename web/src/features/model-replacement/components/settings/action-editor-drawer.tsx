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
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import {
  ACTION_CATEGORIES,
  ACTION_DEFINITIONS,
  ACTION_LIMIT_PARAMS,
  MAX_ACTIONS,
  ROUTING_LIMIT,
  createAction,
  validateAction,
  type ActionParam,
} from '../../lib/actions'
import type { ActionType, DetectionAction } from '../../types'
import { ACTION_ICONS } from './action-icons'

type ActionEditorDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Changes every time the drawer opens so the draft restarts from `actions`. */
  session: number
  title: string
  description: string
  actions: DetectionAction[]
  groups: string[]
  onSave: (actions: DetectionAction[]) => void
}

/**
 * Drawer that edits one ordered action list, like a shortcut: actions are
 * added from a menu, reordered, and run top to bottom.
 */
export function ActionEditorDrawer(props: ActionEditorDrawerProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        className={sideDrawerContentClassName('max-w-none sm:!max-w-[560px]')}
      >
        <ActionSequenceEditor
          key={props.session}
          title={props.title}
          description={props.description}
          actions={props.actions}
          groups={props.groups}
          onSave={props.onSave}
        />
      </SheetContent>
    </Sheet>
  )
}

type Step = { key: number; action: DetectionAction }

const NUMBER_MIN: Partial<Record<ActionParam, number>> = {
  amount: 1,
  priority: -ROUTING_LIMIT,
  weight: 0,
}

type ActionSequenceEditorProps = Omit<
  ActionEditorDrawerProps,
  'open' | 'onOpenChange' | 'session'
>

function ActionSequenceEditor(props: ActionSequenceEditorProps) {
  const { t } = useTranslation()
  const nextKey = useRef(props.actions.length)
  const [steps, setSteps] = useState<Step[]>(() =>
    props.actions.map((action, index) => ({ key: index, action }))
  )
  const [showErrors, setShowErrors] = useState(false)
  const groupOptions = props.groups.map((group) => ({
    value: group,
    label: group,
  }))

  const addStep = (type: ActionType) => {
    const key = nextKey.current++
    setSteps((current) => [...current, { key, action: createAction(type) }])
  }
  const updateStep = (key: number, patch: Partial<DetectionAction>) => {
    setSteps((current) =>
      current.map((step) =>
        step.key === key ? { key, action: { ...step.action, ...patch } } : step
      )
    )
  }
  const moveStep = (index: number, offset: -1 | 1) => {
    setSteps((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(index + offset, 0, moved)
      return next
    })
  }
  const removeStep = (key: number) => {
    setSteps((current) => current.filter((step) => step.key !== key))
  }
  const handleDone = () => {
    if (steps.some((step) => validateAction(step.action))) {
      setShowErrors(true)
      return
    }
    props.onSave(
      steps.map((step) => ({ ...step.action, value: step.action.value.trim() }))
    )
  }

  return (
    <>
      <SheetHeader className={sideDrawerHeaderClassName()}>
        <SheetTitle>{props.title}</SheetTitle>
        <SheetDescription>{props.description}</SheetDescription>
      </SheetHeader>
      <div className={sideDrawerFormClassName('gap-3')}>
        {steps.length === 0 ? (
          <p className='text-muted-foreground rounded-md border border-dashed px-4 py-8 text-center text-sm'>
            {t('No actions yet. Add an action to build the sequence.')}
          </p>
        ) : (
          <ol className='flex flex-col gap-2' aria-label={props.title}>
            {steps.map((step, index) => {
              const definition = ACTION_DEFINITIONS[step.action.type]
              const Icon = ACTION_ICONS[step.action.type]
              const label = t(definition.label)
              const inputId = `detection-action-${step.key}`
              const error = showErrors ? validateAction(step.action) : null
              return (
                <li
                  key={step.key}
                  className='bg-card flex min-w-0 flex-col gap-2.5 rounded-lg border p-3'
                >
                  <div className='flex items-center gap-2'>
                    <span className='bg-muted text-muted-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums'>
                      {index + 1}
                    </span>
                    <Icon
                      className='text-muted-foreground size-4 shrink-0'
                      aria-hidden='true'
                    />
                    <span className='min-w-0 flex-1 truncate text-sm font-medium'>
                      {label}
                    </span>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      disabled={index === 0}
                      aria-label={t('Move {{action}} up', { action: label })}
                      onClick={() => moveStep(index, -1)}
                    >
                      <ChevronUp aria-hidden='true' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      disabled={index === steps.length - 1}
                      aria-label={t('Move {{action}} down', { action: label })}
                      onClick={() => moveStep(index, 1)}
                    >
                      <ChevronDown aria-hidden='true' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      aria-label={t('Remove {{action}}', { action: label })}
                      onClick={() => removeStep(step.key)}
                    >
                      <Trash2 aria-hidden='true' />
                    </Button>
                  </div>
                  {definition.param !== 'none' && (
                    <div className='grid gap-1.5 ps-8'>
                      <Label htmlFor={inputId} className='text-xs'>
                        {definition.param === 'group' && t('Group')}
                        {definition.param === 'tag' && t('Tag')}
                        {definition.param === 'optional-tag' &&
                          t('Tag to remove')}
                        {definition.param === 'amount' && t('Amount')}
                        {definition.param === 'priority' && t('Priority')}
                        {definition.param === 'weight' && t('Weight')}
                      </Label>
                      {definition.param === 'group' && (
                        <Combobox
                          id={inputId}
                          options={groupOptions}
                          value={step.action.value}
                          onValueChange={(value) =>
                            updateStep(step.key, { value: value ?? '' })
                          }
                          allowCustomValue
                          placeholder={t('Select or enter a group')}
                          className='w-full'
                          aria-invalid={error ? true : undefined}
                        />
                      )}
                      {(definition.param === 'tag' ||
                        definition.param === 'optional-tag') && (
                        <Input
                          id={inputId}
                          value={step.action.value}
                          maxLength={64}
                          placeholder={
                            definition.param === 'optional-tag'
                              ? t('Leave empty to remove any tag')
                              : undefined
                          }
                          aria-invalid={error ? true : undefined}
                          onChange={(event) =>
                            updateStep(step.key, { value: event.target.value })
                          }
                        />
                      )}
                      {(definition.param === 'amount' ||
                        definition.param === 'priority' ||
                        definition.param === 'weight') && (
                        <Input
                          id={inputId}
                          type='number'
                          step={1}
                          min={NUMBER_MIN[definition.param]}
                          max={ROUTING_LIMIT}
                          value={
                            Number.isFinite(step.action.amount)
                              ? step.action.amount
                              : ''
                          }
                          aria-invalid={error ? true : undefined}
                          onChange={(event) =>
                            updateStep(step.key, {
                              amount: event.target.valueAsNumber,
                            })
                          }
                        />
                      )}
                      {error && (
                        <p className='text-destructive text-xs' role='alert'>
                          {t(error, ACTION_LIMIT_PARAMS)}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type='button'
                variant='outline'
                className='self-start'
                disabled={steps.length >= MAX_ACTIONS}
              />
            }
          >
            <Plus aria-hidden='true' data-icon='inline-start' />
            {t('Add action')}
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='min-w-60'>
            {ACTION_CATEGORIES.map((category, index) => (
              <DropdownMenuGroup key={category.id}>
                {index > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{t(category.label)}</DropdownMenuLabel>
                {category.types.map((type) => {
                  const Icon = ACTION_ICONS[type]
                  return (
                    <DropdownMenuItem key={type} onClick={() => addStep(type)}>
                      <Icon aria-hidden='true' />
                      {t(ACTION_DEFINITIONS[type].label)}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {steps.length >= MAX_ACTIONS && (
          <p className='text-muted-foreground text-xs'>
            {t('At most {{max}} actions can be configured for each result', {
              max: MAX_ACTIONS,
            })}
          </p>
        )}
      </div>
      <SheetFooter className={sideDrawerFooterClassName()}>
        <SheetClose
          render={<Button variant='outline' className='w-full sm:w-auto' />}
        >
          {t('Cancel')}
        </SheetClose>
        <Button type='button' className='w-full sm:w-auto' onClick={handleDone}>
          {t('Done')}
        </Button>
      </SheetFooter>
    </>
  )
}
