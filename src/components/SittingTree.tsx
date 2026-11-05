import aliveTree from '../assets/chant-tree/alive.png';
import bareTree from '../assets/chant-tree/bare.png';

export function SittingTree({ withered }: { withered: boolean }) {
  return (
    <div
      className="bead-chant-tree"
      role="img"
      aria-label={withered ? 'Bare branches' : 'Living tree'}
    >
      <img
        className={withered ? 'bead-chant-tree-bare is-shown' : 'bead-chant-tree-bare'}
        src={bareTree}
        alt=""
      />
      <img
        className={withered ? 'bead-chant-tree-alive is-falling' : 'bead-chant-tree-alive'}
        src={aliveTree}
        alt=""
      />
    </div>
  );
}
