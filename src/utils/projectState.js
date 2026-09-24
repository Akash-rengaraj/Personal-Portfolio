/** Collapse the free-form status strings in the project data into two display states. */
export function projectState(status = '') {
  return /complete/i.test(status) ? { label: 'shipped', tone: 'done' } : { label: 'in progress', tone: 'wip' };
}
