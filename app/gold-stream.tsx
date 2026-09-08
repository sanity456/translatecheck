'use client';

import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Decorative motion is independent of the wallet and translation workspace.
export function GoldStream() {
  const [paused, setPaused] = useState(false);

  return (
    <>
      <div
        className="gold-stream-backdrop"
        data-paused={paused}
        aria-hidden="true"
      />
      <Button
        type="button"
        variant="outline"
        className="background-motion"
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        {paused ? 'Resume background' : 'Pause background'}
      </Button>
    </>
  );
}
