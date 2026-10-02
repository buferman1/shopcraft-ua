"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  emailSchema,
  passwordSchema,
  loginPasswordSchema,
  type ActionState,
} from "@/lib/validation";
import { requireUser } from "@/lib/access";
function origin() {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value)
    throw new Error("NEXT_PUBLIC_APP_URL is required for email redirects");
  return new URL(value).origin;
}
export async function authenticate(
  mode: string,
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  if (!["login", "signup", "forgot", "update"].includes(mode))
    return { error: "Невідома дія." };
  const supabase = await createClient();
  if (mode === "update") {
    const password = passwordSchema.safeParse(data.get("password"));
    if (!password.success)
      return { error: "Пароль має містити від 12 до 128 символів." };
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();
    if (!user || sessionError)
      return {
        error:
          "Відкрийте актуальне посилання з листа або увійдіть у свій профіль.",
      };
    const { error } = await supabase.auth.updateUser({
      password: password.data,
    });
    if (error)
      return { error: "Не вдалося змінити пароль. Спробуйте нове посилання." };
    return { success: "Пароль змінено. Ви можете перейти до кабінету." };
  }
  const email = emailSchema.safeParse(data.get("email"));
  if (!email.success) return { error: "Перевірте email." };
  if (mode === "forgot") {
    const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: origin() + "/auth/callback?next=/auth/update",
    });
    if (error)
      return { error: "Не вдалося надіслати лист. Спробуйте пізніше." };
    return {
      success:
        "Якщо адреса зареєстрована, на неї надійде лист для зміни пароля.",
    };
  }
  const password =
    mode === "signup"
      ? passwordSchema.safeParse(data.get("password"))
      : loginPasswordSchema.safeParse(data.get("password"));
  if (!password.success)
    return {
      error:
        mode === "signup"
          ? "Пароль має містити від 12 до 128 символів."
          : "Вкажіть пароль.",
    };
  if (mode === "signup") {
    const { data: result, error } = await supabase.auth.signUp({
      email: email.data,
      password: password.data,
      options: { emailRedirectTo: origin() + "/auth/callback" },
    });
    if (error)
      return {
        error:
          error.status === 429
            ? "Забагато спроб. Зачекайте й повторіть."
            : "Реєстрація недоступна. Перевірте дані або спробуйте пізніше.",
      };
    if (result.session) redirect("/dashboard");
    return {
      success:
        "Перевірте пошту та підтвердьте адресу. Якщо профіль уже існує, скористайтеся входом.",
    };
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });
  if (error)
    return {
      error:
        error.status === 429
          ? "Забагато спроб. Зачекайте й повторіть."
          : "Не вдалося увійти. Перевірте email, пароль і підтвердження пошти.",
    };
  redirect("/dashboard");
}
export async function signOut() {
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Не вдалося завершити сесію.");
  redirect("/auth/login");
}
