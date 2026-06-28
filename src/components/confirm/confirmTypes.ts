export type ConfirmVariant = 'danger' | 'warning';

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  confirmationText?: string;
};
