import React from 'react';

export function SittingGrove({
  marks,
  livingCount,
}: {
  marks: { id: string; result: 'grown' | 'withered' }[];
  livingCount: number;
}) {
  const countLabel = livingCount === 1 ? '1 living plant' : `${livingCount} living plants`;
  return (
    <section className="sitting-grove" aria-label="Chant grove">
      {marks.map((mark) => (
        <span key={mark.id} className={`sitting-grove-mark is-${mark.result}`}>
          {mark.result === 'grown' ? 'Living plant' : 'Stump'}
        </span>
      ))}
      <span className="sitting-grove-count">{countLabel}</span>
    </section>
  );
}
