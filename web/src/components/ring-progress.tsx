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
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type RingProgressProps = {
  /** 0-100; null draws only the track. */
  percent: number | null
  size?: number
  strokeWidth?: number
  /** Color of the filled arc, as a text color class (the arc uses currentColor). */
  className?: string
  /** Color of the unfilled track, as a text color class. */
  trackClassName?: string
  /** Content centered inside the ring, such as the percentage. */
  children?: ReactNode
}

/**
 * Circular meter: a filled arc over a track of the same shape. It is
 * decorative; callers provide the value as text (children or a label).
 */
export function RingProgress(props: RingProgressProps) {
  const size = props.size ?? 22
  const stroke = props.strokeWidth ?? 2.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const percent =
    props.percent === null ? null : Math.min(100, Math.max(0, props.percent))
  const offset =
    percent === null
      ? circumference
      : circumference - (percent / 100) * circumference

  const ring = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className='shrink-0 -rotate-90'
      aria-hidden='true'
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill='none'
        strokeWidth={stroke}
        stroke='currentColor'
        className={props.trackClassName ?? 'text-muted'}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill='none'
        strokeWidth={stroke}
        strokeLinecap='round'
        stroke='currentColor'
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={cn(
          'transition-[stroke-dashoffset] duration-500',
          props.className
        )}
      />
    </svg>
  )

  if (props.children == null) return ring
  return (
    <span
      className='relative inline-flex shrink-0 items-center justify-center'
      style={{ width: size, height: size }}
    >
      {ring}
      <span className='absolute inset-0 flex items-center justify-center'>
        {props.children}
      </span>
    </span>
  )
}
