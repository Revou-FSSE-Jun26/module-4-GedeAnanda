/**
 * The app's only door to `react-hot-toast` besides the `<Toaster />` in the
 * root layout (guideline FE-03).
 */
import hotToast from "react-hot-toast";

export const toast = {
  success: (message: string) => hotToast.success(message),
  error: (message: string) => hotToast.error(message),
  loading: (message: string) => hotToast.loading(message),
  dismiss: (id?: string) => hotToast.dismiss(id),
};
