import Link from "next/link";
import { requireUser } from "@/lib/access";
export default async function Dashboard() {
  const { supabase } = await requireUser();
  const { data: stores, error } = await supabase
    .from("stores")
    .select("id,name,slug,status,currency")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Не вдалося отримати магазини.");
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">ВАШ РОБОЧИЙ ПРОСТІР</p>
          <h1>Мої магазини</h1>
          <p className="muted">Усе, що потрібно для нового старту.</p>
        </div>
        <Link className="button" href="/dashboard/new">
          + Створити магазин
        </Link>
      </div>
      <div className="store-grid">
        {stores?.map((s) => (
          <Link
            className="card store-card"
            href={"/dashboard/stores/" + s.id}
            key={s.id}
          >
            <div className="store-monogram">
              {s.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="badge">
              {s.status === "active" ? "Опубліковано" : "Чернетка"}
            </span>
            <h2>{s.name}</h2>
            <p className="muted">
              {s.slug} · {s.currency}
            </p>
            <span className="text-link">Відкрити кабінет →</span>
          </Link>
        ))}
      </div>
      {!stores?.length && (
        <section className="card empty">
          <h2>Місце для вашого першого бренду</h2>
          <p>Дайте магазину назву, виберіть валюту та додайте перший товар.</p>
          <Link className="button" href="/dashboard/new">
            Створити магазин
          </Link>
        </section>
      )}
    </>
  );
}
