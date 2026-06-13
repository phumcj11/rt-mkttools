import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

const BTN_CONFIRM = '#dc2626';
const BTN_CANCEL = '#64748b';

const base = {
  confirmButtonColor: BTN_CONFIRM,
  cancelButtonColor: BTN_CANCEL,
  buttonsStyling: true,
  customClass: {
    popup: 'rounded-xl shadow-lg',
    title: 'text-lg font-semibold',
    confirmButton: 'rounded-lg px-4 py-2',
    cancelButton: 'rounded-lg px-4 py-2',
  },
};

export async function confirmAction(options: {
  title: string;
  text?: string;
  html?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: 'warning' | 'question' | 'info';
}): Promise<boolean> {
  const result = await Swal.fire({
    ...base,
    title: options.title,
    text: options.text,
    html: options.html,
    icon: options.icon ?? 'warning',
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? 'ยืนยัน',
    cancelButtonText: options.cancelText ?? 'ยกเลิก',
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
}

export async function confirmDelete(title: string, text?: string): Promise<boolean> {
  return confirmAction({
    title,
    text,
    confirmText: 'ลบ',
    cancelText: 'ยกเลิก',
    icon: 'warning',
  });
}

export function showSuccess(title: string, text?: string) {
  return Swal.fire({
    ...base,
    title,
    text,
    icon: 'success',
    confirmButtonText: 'ตกลง',
    timer: text ? undefined : 2200,
    timerProgressBar: !text,
  });
}

export function showError(title: string, text?: string) {
  return Swal.fire({
    ...base,
    title,
    text,
    icon: 'error',
    confirmButtonText: 'ตกลง',
  });
}

export function showInfo(title: string, text?: string) {
  return Swal.fire({
    ...base,
    title,
    text,
    icon: 'info',
    confirmButtonText: 'ตกลง',
  });
}
