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
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Ban,
  CircleOff,
  FolderMinus,
  FolderPlus,
  Hash,
  type LucideIcon,
  Minus,
  Plus,
  Tag,
  Tags,
  Weight,
} from 'lucide-react'

import type { ActionType } from '../../types'

export const ACTION_ICONS: Record<ActionType, LucideIcon> = {
  add_group: FolderPlus,
  remove_group: FolderMinus,
  increase_priority: ArrowUpWideNarrow,
  decrease_priority: ArrowDownWideNarrow,
  set_priority: Hash,
  increase_weight: Plus,
  decrease_weight: Minus,
  set_weight: Weight,
  auto_disable: CircleOff,
  manual_disable: Ban,
  set_tag: Tag,
  remove_tag: Tags,
}
