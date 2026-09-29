import type { ButtonHTMLAttributes, Ref } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-surface hover:opacity-90',
  secondary: 'border border-content-muted/40 text-content hover:bg-surface-raised',
  danger: 'border border-red-500/60 text-red-600 hover:bg-red-500/10 dark:text-red-400'
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant
  readonly ref?: Ref<HTMLButtonElement>
}

/** Bouton de base : hauteur 32 px (Fitts), focus visible via le style global, désactivé pendant un traitement. */
export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={`h-8 rounded-md px-4 text-sm font-medium transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
