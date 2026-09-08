import { createElement } from 'react';

// Errors replace earlier instructions rather than appearing alongside them.
export function RequestFeedback({
  error,
  notice,
}: {
  error: string;
  notice: string;
}) {
  if (error)
    return createElement(
      'div',
      { className: 'notice error', role: 'alert' },
      error,
    );
  if (notice)
    return createElement('output', { className: 'notice block' }, notice);
  return null;
}
