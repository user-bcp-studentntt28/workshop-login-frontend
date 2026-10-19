import { describe, expect, it } from 'vitest';
import { formatTaskLabel } from './legacy-format';

describe('formatTaskLabel', () => {
  it('formats priority and owner', () => {
    expect(formatTaskLabel({ priority: 'high', owner: 'student' })).toBe('HIGH · STUDENT');
  });

  it('uses defaults when priority or owner is missing', () => {
    expect(formatTaskLabel({})).toBe('NORMAL · SIN-ASIGNAR');
    expect(formatTaskLabel({ priority: 'low', owner: null })).toBe('LOW · SIN-ASIGNAR');
  });

  it('returns a fallback for absent task data', () => {
    expect(formatTaskLabel(null)).toBe('SIN-DATOS');
  });
});
