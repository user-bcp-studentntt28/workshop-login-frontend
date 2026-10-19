import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('login template output safety', () => {
  it('binds dynamic messages as text instead of HTML', () => {
    const template = readFileSync(new URL('./login.component.html', import.meta.url), 'utf8');

    expect(template).not.toContain('[innerHTML]');
    expect(template).toContain('{{ message }}');
  });
});
