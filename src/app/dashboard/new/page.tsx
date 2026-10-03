import { ActionForm, Field } from "@/components/action-form";
import { createStore } from "../actions";
export default function NewStore() {
  return (
    <>
      <p className="eyebrow">НОВИЙ ПОЧАТОК</p>
      <h1>Створіть свій магазин</h1>
      <p className="muted">Назву й каталог можна доповнити пізніше.</p>
      <section className="card narrow">
        <ActionForm action={createStore} label="Створити магазин">
          <Field name="name" label="Назва магазину" maxLength={120} />
          <Field
            name="slug"
            label="Адреса: латинські літери, цифри, дефіси"
            maxLength={80}
          />
          <label className="field">
            Валюта
            <select name="currency">
              <option value="UAH">Гривня · UAH</option>
              <option value="USD">Долар · USD</option>
              <option value="EUR">Євро · EUR</option>
              <option value="PLN">Злотий · PLN</option>
            </select>
          </label>
          <label className="field">
            Основна мова
            <select name="locale">
              <option value="uk">Українська</option>
              <option value="en">English</option>
              <option value="pl">Polski</option>
              <option value="de">Deutsch</option>
            </select>
          </label>
        </ActionForm>
      </section>
    </>
  );
}
