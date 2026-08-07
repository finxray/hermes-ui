import styles from "./WindowBackButton.module.css";

type WindowBackButtonProps = {
  onClick: () => void;
};

export function WindowBackButton({ onClick }: WindowBackButtonProps) {
  return (
    <button aria-label="Go back" className={styles.button} onClick={onClick} type="button">
      <span aria-hidden="true" />
    </button>
  );
}
