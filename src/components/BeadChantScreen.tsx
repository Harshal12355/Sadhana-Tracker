import React from 'react';

export function BeadChantScreen({
  beadsInRound,
  completedRounds,
  volumeAllowed,
  volumeOn,
  volumeArmed,
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
      <button type="button" className="bead-chant-tap" onClick={onBead} aria-label="One bead">
        One bead
      </button>
      <div className="bead-chant-actions">
        <button type="button" className="btn-secondary-pill" onClick={onBack}>
          Back one bead
        </button>
        <button type="button" className="btn-secondary-pill" onClick={onClose}>
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
