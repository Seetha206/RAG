import { toast } from 'react-toastify';

export type AlertType = 'success' | 'danger' | 'warning' | 'info';

export const showAlert = (type: AlertType, message: string): void => {
  const toastFn = type === 'danger' ? toast.error : toast[type];
  toastFn(message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
  });
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return 'An unexpected error occurred';
};
