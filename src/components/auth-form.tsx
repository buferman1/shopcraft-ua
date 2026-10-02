"use client";
import { useActionState, startTransition } from "react";
import { useForm } from "react-hook-form";
import { authenticate } from "@/app/auth/actions";
export function AuthForm({ mode }: { mode: string }) {
  const [state, action, pending] = useActionState(
    authenticate.bind(null, mode),
    {},
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string; password: string }>();
  const labels: Record<string, string> = {
    login: "Увійти",
    signup: "Створити профіль",
    forgot: "Отримати лист",
    update: "Змінити пароль",
  };
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit((values) => {
        const data = new FormData();
        Object.entries(values).forEach(([k, v]) => data.set(k, v));
        startTransition(() => action(data));
      })}
    >
      <fieldset disabled={pending}>
        {mode !== "update" && (
          <label className="field">
            Email
            <input
              type="email"
              autoComplete="email"
              {...register("email", {
                required: "Вкажіть email",
                maxLength: 254,
              })}
            />
            {errors.email && <span role="alert">{errors.email.message}</span>}
          </label>
        )}
        {mode !== "forgot" && (
          <label className="field">
            Пароль
            <input
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              {...register("password", {
                required: "Вкажіть пароль",
                minLength: {
                  value: mode === "login" ? 1 : 12,
                  message: "Мінімум 12 символів",
                },
                maxLength: 128,
              })}
            />
            {errors.password && (
              <span role="alert">{errors.password.message}</span>
            )}
          </label>
        )}
      </fieldset>
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
        {pending ? "Зачекайте…" : labels[mode]}
      </button>
    </form>
  );
}
