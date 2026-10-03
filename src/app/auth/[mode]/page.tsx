import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { mode } = await params;
  const query = await searchParams;
  const titles: Record<string, string> = {
    login: "З поверненням",
    signup: "Ваш магазин починається тут",
    forgot: "Відновлення доступу",
    update: "Новий пароль",
  };
  if (!titles[mode]) notFound();
  return (
    <main className="auth-shell">
      <Link className="brand" href="/">
        ShopCraft <span>UA</span>
      </Link>
      <section className="card auth-card">
        <p className="eyebrow">ВАШ БІЗНЕС. ВАШІ ПРАВИЛА.</p>
        <h1>{titles[mode]}</h1>
        <p className="muted">Керуйте fashion-бізнесом в одному кабінеті.</p>
        {query.error && (
          <p role="alert" className="notice error">
            Посилання недійсне або застаріле. Спробуйте ще раз.
          </p>
        )}
        <AuthForm mode={mode} />
        <nav className="auth-links">
          <Link href="/auth/login">Вхід</Link>
          <Link href="/auth/signup">Реєстрація</Link>
          <Link href="/auth/forgot">Забули пароль?</Link>
          {mode === "update" && <Link href="/dashboard">До кабінету</Link>}
        </nav>
      </section>
    </main>
  );
}
