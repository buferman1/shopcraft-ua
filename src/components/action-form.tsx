"use client";
import { useActionState } from "react";
import type { ActionState } from "@/lib/validation";
export function ActionForm({
  action,
  children,
  label = "Зберегти",
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="form-stack">
      <fieldset disabled={pending}>{children}</fieldset>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice success">
          {state.success}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Збереження…" : label}
      </button>
    </form>
  );
}
export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = true,
  maxLength,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  maxLength?: number;
  min?: number;
  step?: string;
}) {
  return (
    <label className="field">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        min={min}
        step={step}
      />
    </label>
  );
}
