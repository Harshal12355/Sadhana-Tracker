import React from 'react';

export function VowLine({
  text,
  onStart,
  onSkip,
}: {
  text: string;
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <section className="vow-line" aria-label="Rounds still left">
      <p>{text}</p>
      <button type="button" className="btn-primary-pill" onClick={onStart}>
        Start a sitting
      </button>
      <button type="button" className="btn-secondary-pill" onClick={onSkip}>
        Skip today
      </button>
    </section>
  );
}
