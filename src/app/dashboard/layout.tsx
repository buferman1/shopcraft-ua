import Link from "next/link";
import { requireUser } from "@/lib/access";
import { signOut } from "@/app/auth/actions";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          ShopCraft <span>UA</span>
        </Link>
        <p className="eyebrow">РОБОЧИЙ ПРОСТІР</p>
        <nav>
          <Link href="/dashboard">Мої магазини</Link>
          <Link href="/dashboard/new">Створити магазин</Link>
          <Link href="/dashboard/profile">Мій профіль</Link>
        </nav>
        <div className="sidebar-bottom">
          <p className="muted">{user.email}</p>
          <form action={signOut}>
            <button className="button secondary">Вийти</button>
          </form>
        </div>
      </aside>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
