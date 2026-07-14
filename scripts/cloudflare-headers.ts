interface CloudflareHeaderOperation {
  name: string;
  value: string | null;
}

interface CloudflareHeaderRule {
  operations: CloudflareHeaderOperation[];
  pattern: string;
  regexp: RegExp;
}

function compilePathPattern(pattern: string): RegExp {
  if (!pattern.startsWith("/")) {
    throw new Error(`Only path-based Cloudflare header rules are supported locally: '${pattern}'.`);
  }
  if (pattern.includes(":")) {
    throw new Error(`Cloudflare header placeholders are not supported locally: '${pattern}'.`);
  }
  if ((pattern.match(/\*/gu) ?? []).length > 1) {
    throw new Error(`Cloudflare header rules may contain at most one splat: '${pattern}'.`);
  }

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/gu, "\\$&").replace("*", ".*");
  return new RegExp(`^${escaped}$`, "u");
}

function parseCloudflareHeaders(source: string): CloudflareHeaderRule[] {
  const rules: CloudflareHeaderRule[] = [];
  let currentRule: CloudflareHeaderRule | null = null;

  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    if (!/^\s/u.test(line)) {
      currentRule = {
        operations: [],
        pattern: trimmed,
        regexp: compilePathPattern(trimmed),
      };
      rules.push(currentRule);
      continue;
    }

    if (currentRule === null) {
      throw new Error(`Header operation on line ${index + 1} has no preceding path rule.`);
    }
    if (trimmed.startsWith("! ")) {
      currentRule.operations.push({ name: trimmed.slice(2).trim(), value: null });
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator <= 0) {
      throw new Error(`Invalid Cloudflare header operation on line ${index + 1}: '${trimmed}'.`);
    }

    currentRule.operations.push({
      name: trimmed.slice(0, separator).trim(),
      value: trimmed.slice(separator + 1).trim(),
    });
  }

  return rules;
}

function applyCloudflareHeaders(
  rules: readonly CloudflareHeaderRule[],
  pathname: string,
  defaults: HeadersInit = {},
): Headers {
  const result = new Headers(defaults);
  const customNames = new Set<string>();

  for (const rule of rules) {
    if (!rule.regexp.test(pathname)) {
      continue;
    }

    for (const operation of rule.operations) {
      const normalizedName = operation.name.toLowerCase();

      if (operation.value === null) {
        result.delete(operation.name);
        customNames.delete(normalizedName);
      } else if (customNames.has(normalizedName)) {
        result.append(operation.name, operation.value);
      } else {
        result.set(operation.name, operation.value);
        customNames.add(normalizedName);
      }
    }
  }

  return result;
}

export { applyCloudflareHeaders, parseCloudflareHeaders, type CloudflareHeaderRule };
