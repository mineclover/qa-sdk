// @def.boundary viz-system-root
// @def.doc viz-system-root

import type { GraphRole } from '@qa-sdk/event-catalog';

export type NodeState = 'pending' | 'active' | 'matched' | 'failed' | 'skipped';

/**
 * Returns CSS class names for a graph node based on its role and current state.
 */
export function getNodeClass(role: GraphRole | undefined, state: NodeState): string {
  const classes: string[] = ['graph-node'];

  switch (role) {
    case 'entry':
      classes.push('role-entry');
      break;
    case 'transition':
      classes.push('role-transition');
      break;
    case 'terminal':
      classes.push('role-terminal');
      break;
    case 'observation':
      classes.push('role-observation');
      break;
    default:
      classes.push('role-default');
      break;
  }

  classes.push(`state-${state}`);

  return classes.join(' ');
}

/**
 * Returns CSS class for an edge based on its type.
 */
export function getEdgeClass(type: 'sequence' | 'branch' | 'optional'): string {
  return `graph-edge edge-${type}`;
}
