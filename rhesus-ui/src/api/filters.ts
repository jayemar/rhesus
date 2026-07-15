import { call } from './client'
import type { ApiFilter } from '@/types/api'

export async function getFilters(): Promise<ApiFilter[]> {
  const res = await call<{ filters: ApiFilter[] }>('getFilters')
  return res.filters
}

export async function saveFilter(
  filter: Omit<ApiFilter, 'id'> & { id?: number },
): Promise<{ id: number }> {
  return call<{ id: number }>('saveFilter', {
    id: filter.id,
    title: filter.title,
    enabled: filter.enabled,
    match_any_rule: filter.match_any_rule,
    inverse: filter.inverse,
    rules: JSON.stringify(filter.rules),
    actions: JSON.stringify(filter.actions),
  })
}

export async function deleteFilter(id: number): Promise<void> {
  await call('deleteFilter', { id })
}

export async function setFilterEnabled(id: number, enabled: boolean): Promise<void> {
  await call('setFilterEnabled', { id, enabled })
}
