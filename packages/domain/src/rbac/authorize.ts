import { DomainError } from '../errors.js';
import type { Permission } from './permissions.js';
import { ROLES, type RoleKey } from './roles.js';

export interface Principal {
  userId: string;
  shopId: string;
  roles: readonly RoleKey[];
}

export function permissionsFor(roles: readonly RoleKey[]): Set<Permission> {
  const granted = new Set<Permission>();
  for (const role of roles) {
    const definition = ROLES[role];
    if (!definition) continue;
    for (const permission of definition.permissions) granted.add(permission);
  }
  return granted;
}

export function can(principal: Principal, permission: Permission): boolean {
  return permissionsFor(principal.roles).has(permission);
}

/**
 * Throws rather than returning false, because the calling loader should not be able
 * to continue by accident. Naming the permission in the error keeps the refusal
 * explainable, which section 8 asks of every error.
 */
export function requirePermission(principal: Principal, permission: Permission): void {
  if (!can(principal, permission)) {
    throw new DomainError('forbidden', `This account lacks the ${permission} permission.`, {
      permission,
      roles: principal.roles,
    });
  }
}

/** True when the principal holds every one of the permissions. */
export function canAll(principal: Principal, permissions: readonly Permission[]): boolean {
  const granted = permissionsFor(principal.roles);
  return permissions.every((p) => granted.has(p));
}
