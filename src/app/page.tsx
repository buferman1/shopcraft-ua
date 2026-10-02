import Link from "next/link";
export default function Home() {
  return (
    <>
      <header className="public-header">
        <Link className="brand" href="/">
          ShopCraft <span>UA</span>
        </Link>
        <Link className="button secondary" href="/auth/login">
          Увійти
        </Link>
      </header>
      <main className="hero">
        <div>
          <p className="eyebrow">ПРОСТІР ДЛЯ ВАШОГО БРЕНДУ</p>
          <h1>
            Ідея ваша.
            <br />
            Магазин теж.
          </h1>
          <p>
            Створіть магазин одягу, взуття чи аксесуарів. Почніть із каталогу —
            додайте товари, розміри й кольори та керуйте ними в одному місці.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/auth/signup">
              Створити профіль →
            </Link>
            <Link className="text-link" href="/dashboard">
              До мого кабінету
            </Link>
          </div>
          <p className="release-note">
            Ранній доступ: працюють профіль, магазини й каталог. Публікація
            вітрини, замовлення та платежі ще розробляються.
          </p>
        </div>
        <section
          className="brand-art"
          aria-label="Простір для вашого fashion-бренду"
        >
          <div className="art-label">
            YOUR NEXT
            <br />
            BIG THING.
          </div>
          <div className="art-circle" />
          <div className="art-footer">CRAFTED BY YOU · MADE IN UKRAINE</div>
        </section>
      </main>
      <footer className="public-footer">
        ShopCraft UA · Ваш бізнес починається з ідеї.
      </footer>
    </>
  );
}
