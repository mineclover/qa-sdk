import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAutoCapture } from './auto-capture.js';

describe('createAutoCapture — clicks', () => {
  let emit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emit = vi.fn();
    document.body.innerHTML = '';
  });

  it('emits click for a <button>', () => {
    const cleanup = createAutoCapture({ clicks: true }, emit);
    const btn = document.createElement('button');
    btn.textContent = 'Submit';
    document.body.appendChild(btn);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cleanup();

    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith(
      'click',
      expect.objectContaining({ tag: 'button', text: 'Submit' }),
    );
  });

  it('emits click for an <a> link', () => {
    const cleanup = createAutoCapture({ clicks: true }, emit);
    const a = document.createElement('a');
    a.href = 'https://example.com';
    a.textContent = 'Go';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cleanup();

    const payload = emit.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.tag).toBe('a');
    expect(payload.href as string).toContain('example.com');
  });

  it('emits click for [data-qa-event] element', () => {
    const cleanup = createAutoCapture({ clicks: true }, emit);
    const div = document.createElement('div');
    div.dataset['qaEvent'] = 'custom_action';
    document.body.appendChild(div);
    div.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cleanup();

    expect(emit).toHaveBeenCalledWith(
      'click',
      expect.objectContaining({ qa_event: 'custom_action' }),
    );
  });

  it('does NOT emit click for a plain <div>', () => {
    const cleanup = createAutoCapture({ clicks: true }, emit);
    const div = document.createElement('div');
    document.body.appendChild(div);
    div.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cleanup();

    expect(emit).not.toHaveBeenCalled();
  });

  it('stops emitting after cleanup', () => {
    const cleanup = createAutoCapture({ clicks: true }, emit);
    cleanup();

    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emit).not.toHaveBeenCalled();
  });

  it('truncates button text to 100 chars', () => {
    const cleanup = createAutoCapture({ clicks: true }, emit);
    const btn = document.createElement('button');
    btn.textContent = 'x'.repeat(200);
    document.body.appendChild(btn);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cleanup();

    const payload = emit.mock.calls[0][1] as Record<string, unknown>;
    expect((payload.text as string).length).toBe(100);
  });
});

describe('createAutoCapture — forms', () => {
  let emit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emit = vi.fn();
    document.body.innerHTML = '';
  });

  it('emits form_submit on form submit', () => {
    const cleanup = createAutoCapture({ forms: true }, emit);
    const form = document.createElement('form');
    form.id = 'checkout-form';
    document.body.appendChild(form);
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true }));
    cleanup();

    expect(emit).toHaveBeenCalledWith(
      'form_submit',
      expect.objectContaining({ form_id: 'checkout-form' }),
    );
  });

  it('stops emitting after cleanup', () => {
    const cleanup = createAutoCapture({ forms: true }, emit);
    cleanup();

    const form = document.createElement('form');
    document.body.appendChild(form);
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true }));

    expect(emit).not.toHaveBeenCalled();
  });
});

describe('createAutoCapture — navigation', () => {
  let emit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emit = vi.fn();
  });

  it('emits page_view on popstate', () => {
    const cleanup = createAutoCapture({ navigation: true }, emit);
    window.dispatchEvent(new PopStateEvent('popstate'));
    cleanup();

    expect(emit).toHaveBeenCalledWith(
      'page_view',
      expect.objectContaining({ url: expect.any(String) }),
    );
  });

  it('patches history.pushState and emits page_view', () => {
    const cleanup = createAutoCapture({ navigation: true }, emit);
    history.pushState({}, '', '/new-path');
    cleanup();

    expect(emit).toHaveBeenCalledWith(
      'page_view',
      expect.objectContaining({ url: expect.any(String) }),
    );
  });

  it('restores original history.pushState on cleanup — stops emitting', () => {
    const cleanup = createAutoCapture({ navigation: true }, emit);
    cleanup();

    emit.mockClear();
    // Calling pushState after cleanup should not emit page_view
    history.pushState({}, '', '/after-cleanup');
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('createAutoCapture — disabled options', () => {
  it('does not capture clicks when clicks:false', () => {
    const emit = vi.fn();
    const cleanup = createAutoCapture({ clicks: false, forms: false, navigation: false }, emit);

    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cleanup();

    expect(emit).not.toHaveBeenCalled();
  });

  it('cleanup on empty config does not throw', () => {
    const emit = vi.fn();
    expect(() => createAutoCapture({}, emit)()).not.toThrow();
  });
});
