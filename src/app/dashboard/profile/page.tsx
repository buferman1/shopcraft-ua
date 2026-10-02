import Link from "next/link";
import { requireUser } from "@/lib/access";
import { ActionForm, Field } from "@/components/action-form";
import { saveProfile } from "../actions";
export default async function Profile() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  if (error) throw new Error("Не вдалося отримати профіль.");
  return (
    <>
      <h1>Мій профіль</h1>
      <section className="card narrow">
        <p className="muted">{user.email}</p>
        <ActionForm action={saveProfile}>
          <Field
            name="display_name"
            label="Ваше ім’я"
            defaultValue={data?.display_name || ""}
            maxLength={120}
          />
        </ActionForm>
        <Link className="text-link" href="/auth/update">
          Змінити пароль →
        </Link>
      </section>
    </>
  );
}
