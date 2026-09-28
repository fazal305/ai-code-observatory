import styles from "./Button.module.css";

const VARIANT_CLASS = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
};

function Button({
  children,
  variant = "secondary",
  size = "md",
  icon = null,
  active = false,
  className = "",
  ...rest
}) {
  const classes = [
    styles.button,
    VARIANT_CLASS[variant] ?? styles.secondary,
    size === "sm" ? styles.sm : styles.md,
    active ? styles.active : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} {...rest}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children ? <span className={styles.label}>{children}</span> : null}
    </button>
  );
}

export default Button;
