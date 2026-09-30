import type { AdvancedRules, FilterConfig, FilterRule } from './filter-config';

export interface FilterTarget {
  url: string;
  method: string;
  status: number;
  resourceType?: string;
}

export function shouldCapture(request: FilterTarget, config: FilterConfig): boolean {
  if (config.enableAdvanced && config.advancedRules) {
    return applyAdvancedRules(request, config.advancedRules);
  }

  // 1. 失败模式
  if (config.captureMode === 'failed_only') {
    const failed = request.status >= 400 || request.status === 0;
    if (!failed) return false;
  }

  // 2. 方法过滤
  if (
    config.methods.length > 0 &&
    !config.methods.includes(request.method.toUpperCase())
  ) {
    return false;
  }

  // 3. URL 排除（优先）
  const lowerUrl = request.url.toLowerCase();
  for (const exclude of config.urlExcludes) {
    if (exclude && lowerUrl.includes(exclude.toLowerCase())) return false;
  }

  // 4. URL 包含
  const includes = config.urlIncludes.filter(Boolean);
  if (includes.length > 0) {
    const matched = includes.some((inc) => lowerUrl.includes(inc.toLowerCase()));
    if (!matched) return false;
  }

  return true;
}

function applyAdvancedRules(request: FilterTarget, rules: AdvancedRules): boolean {
  for (const rule of rules.exclude) {
    if (matchRule(request, rule)) return false;
  }

  if (rules.rules.length === 0) return true;

  if (rules.logic === 'and') return rules.rules.every((r) => matchRule(request, r));
  return rules.rules.some((r) => matchRule(request, r));
}

function matchRule(request: FilterTarget, rule: FilterRule): boolean {
  switch (rule.type) {
    case 'url_contains':
      return (rule.value as string[]).some((v) =>
        request.url.toLowerCase().includes(String(v).toLowerCase()),
      );
    case 'url_regex':
      try {
        return new RegExp(rule.value as string, 'i').test(request.url);
      } catch {
        return false;
      }
    case 'method':
      return (rule.value as string[]).includes(request.method.toUpperCase());
    case 'status_range': {
      const [min, max] = rule.value as [number, number];
      return request.status >= min && request.status <= max;
    }
    case 'resource_type':
      return (rule.value as string[]).includes(request.resourceType ?? '');
    case 'domain':
      try {
        return (rule.value as string[]).includes(new URL(request.url).hostname);
      } catch {
        return false;
      }
    default:
      return false;
  }
}
