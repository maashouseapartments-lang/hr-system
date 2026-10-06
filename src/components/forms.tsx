"use client";

import { useActionState, useEffect, useRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export type ActionState = { error?: string; ok?: string } | null;
export type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function SubmitButton({
  children,
  className = "btn-primary",
  name,
  value,
  confirm,
}: {
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/** نموذج يرسل إلى Server Action ويعرض رسالة النجاح أو الخطأ */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {state.ok}
        </div>
      )}
      {children}
    </form>
  );
}

export function PrintButton({ label = "طباعة" }: { label?: string }) {
  return (
    <button type="button" className="btn-primary no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}

/** قائمة اختيار ترسل النموذج (GET) فور التغيير */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
