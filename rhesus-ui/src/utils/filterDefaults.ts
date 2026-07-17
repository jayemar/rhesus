import type { ApiFilterRule, ApiFilterAction } from '@/types/api'

export type RuleWithScope = ApiFilterRule & { scopeType: 'all' | 'feed' | 'cat' }

export function blankRule(): RuleWithScope {
  return { reg_exp: '', filter_type: 1, inverse: false, feed_id: null, cat_id: null, cat_filter: false, scopeType: 'all' }
}

export function blankAction(): ApiFilterAction {
  return { action_id: 2, action_param: '' }
}

// Escapes a plain string for literal use inside a regex, so filter rules built
// from user-visible text (e.g. a tag) match that text exactly rather than
// having it interpreted as a regex pattern.
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}
