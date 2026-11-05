import React from 'react';
import type { Sitting } from '../sitting';

export function BeadChantScreen({
  beadsInRound,
  completedRounds,
  volumeAllowed,
  volumeOn,
  volumeArmed,
  sitting = null,
  sprout = null,
  sittingNote = null,
  canStartSitting = true,
  onStartSitting,
  onGiveUp,
  onBead,
  onBack,
  onClose,
  onVolumeToggle,
}: {
  beadsInRound: number;
  completedRounds: number;
  volumeAllowed: boolean;
  volumeOn: boolean;
  volumeArmed: boolean;
  sitting?: Sitting | null;
  sprout?: 'Seed' | 'Sprout' | null;
  sittingNote?: string | null;
  canStartSitting?: boolean;
  onStartSitting?: (minutes: 10 | 20 | 30) => void;
  onGiveUp?: () => void;
  onBead: () => void;
  onBack: () => void;
  onClose: () => void;
  onVolumeToggle: (on: boolean) => void;
}) {
  return (
    <div className="bead-chant">
      <p className="bead-chant-count">
        {beadsInRound} / 108
      </p>
      <p className="bead-chant-rounds">{completedRounds} rounds today</p>
      {sittingNote ? (
        <p className="bead-chant-sprout" aria-live="polite">
          {sittingNote}
        </p>
      ) : null}
      {sitting?.result === 'in-progress' ? (
        <p className="bead-chant-sprout">{sprout}</p>
      ) : canStartSitting ? (
        <div className="bead-chant-start">
          <p>Start a sitting</p>
          {([10, 20, 30] as const).map((minutes) => (
            <button key={minutes} type="button" onClick={() => onStartSitting?.(minutes)}>
              {minutes} minutes
            </button>
          ))}
        </div>
      ) : null}
      <button type="button" className="bead-chant-tap" onClick={onBead} aria-label="One bead">
        One bead
      </button>
      <div className="bead-chant-actions">
        <button type="button" className="btn-secondary-pill" onClick={onBack}>
          Back one bead
        </button>
        <button
          type="button"
          className="btn-secondary-pill"
          onClick={sitting?.result === 'in-progress' && onGiveUp ? onGiveUp : onClose}
        >
          Done
        </button>
      </div>
      <label className="bead-chant-volume">
        <input
          type="checkbox"
          checked={volumeAllowed && (volumeOn || volumeArmed)}
          disabled={!volumeAllowed}
          onChange={(event) => {
            if (!volumeAllowed) return;
            onVolumeToggle(event.target.checked);
          }}
        />
        {volumeArmed ? 'Press volume up once.' : 'Volume up counts'}
      </label>
      {volumeAllowed ? null : (
        <p className="bead-chant-note">This phone will not hand over the volume buttons.</p>
      )}
    </div>
  );
}
