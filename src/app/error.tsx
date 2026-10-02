"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="p-8">
      <h1>Не вдалося завантажити сторінку</h1>
      <button className="mt-4 rounded border p-3" onClick={reset}>
        Спробувати ще раз
      </button>
    </main>
  );
}
