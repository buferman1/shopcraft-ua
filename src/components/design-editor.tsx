"use client";
import { useEffect, useState, useTransition } from "react";
import { Storefront } from "./storefront";
import {
  saveDesign,
  publishDesign,
  uploadDesignImage,
  loadDesignVersion,
} from "@/app/dashboard/design-actions";
import {
  themes,
  themeIds,
  applyTheme,
  moveSection,
  newSection,
  sectionNames,
  sectionTypes,
  type Design,
  type DesignSection,
  type SectionType,
  type StoreSummary,
  type CatalogProduct,
  type CatalogCategory,
} from "@/lib/design";

const demoProducts: CatalogProduct[] = [
  {
    id: "demo-1",
    name: "Базова футболка",
    slug: "demo-shirt",
    description: "",
    price: 790,
    category_id: null,
  },
  {
    id: "demo-2",
    name: "Міські кросівки",
    slug: "demo-sneakers",
    description: "",
    price: 2490,
    category_id: null,
  },
  {
    id: "demo-3",
    name: "Легкий жакет",
    slug: "demo-jacket",
    description: "",
    price: 1890,
    category_id: null,
  },
];
const demoCategories: CatalogCategory[] = [
  { id: "demo-c1", name: "Одяг", slug: "demo-clothes" },
  { id: "demo-c2", name: "Взуття", slug: "demo-shoes" },
];

export function DesignEditor({
  store,
  initialDesign,
  initialRevision,
  initialPublishedRevision,
  products,
  categories,
  editable,
  canPublish,
  versions = [],
}: {
  store: StoreSummary;
  initialDesign: Design;
  initialRevision: number;
  initialPublishedRevision: number | null;
  products: CatalogProduct[];
  categories: CatalogCategory[];
  editable: boolean;
  canPublish: boolean;
  versions?: { revision: number; created_at: string }[];
}) {
  const [design, setDesign] = useState(initialDesign);
  const [baseline, setBaseline] = useState(JSON.stringify(initialDesign));
  const [revision, setRevision] = useState(initialRevision);
  const [publishedRevision, setPublishedRevision] = useState(
    initialPublishedRevision,
  );
  const [tab, setTab] = useState<"themes" | "brand" | "blocks">("themes");
  const [selected, setSelected] = useState(initialDesign.sections[0].id);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [dragged, setDragged] = useState<string | null>(null);
  const [past, setPast] = useState<Design[]>([]);
  const [future, setFuture] = useState<Design[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [autosave, setAutosave] = useState(false);
  const [versionToLoad, setVersionToLoad] = useState("");
  const dirty = JSON.stringify(design) !== baseline;
  const selectedBlock = design.sections.find((s) => s.id === selected);
  const publicPath = `/shop/${store.slug}`;

  useEffect(() => {
    if (!autosave || !dirty || !editable || pending || error) return;
    const snapshot = JSON.stringify(design);
    const timer = setTimeout(
      () =>
        startTransition(async () => {
          try {
            const result = await saveDesign(store.id, design, revision);
            if (result.error) {
              setError(result.error);
              return;
            }
            setRevision(result.revision!);
            setBaseline(snapshot);
            setMessage("Чернетку збережено автоматично");
          } catch {
            setError(
              "Автозбереження не вдалося. Перевірте з’єднання та збережіть вручну.",
            );
          }
        }),
      2500,
    );
    return () => clearTimeout(timer);
  }, [autosave, dirty, editable, pending, error, design, revision, store.id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(next: Design) {
    if (!editable || pending) return;
    setPast((current) => [...current.slice(-29), design]);
    setFuture([]);
    setDesign(next);
    setMessage("");
    setError("");
  }
  function field<K extends keyof Design>(key: K, value: Design[K]) {
    change({ ...design, [key]: value });
  }
  function blockField<K extends keyof DesignSection>(
    key: K,
    value: DesignSection[K],
  ) {
    change({
      ...design,
      sections: design.sections.map((s) =>
        s.id === selected ? { ...s, [key]: value } : s,
      ),
    });
  }
  function undo() {
    if (!past.length || pending) return;
    setFuture((current) => [design, ...current]);
    setDesign(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setError("");
  }
  function redo() {
    if (!future.length || pending) return;
    setPast((current) => [...current, design]);
    setDesign(future[0]);
    setFuture(future.slice(1));
    setError("");
  }
  async function save() {
    const result = await saveDesign(store.id, design, revision);
    if (result.error) {
      setError(result.error);
      return null;
    }
    setRevision(result.revision!);
    setBaseline(JSON.stringify(design));
    setMessage(result.success!);
    return result.revision!;
  }
  function perform(operation: "save" | "publish" | "unpublish") {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        if (operation === "save") {
          await save();
          return;
        }
        const savedRevision =
          operation === "publish" && (dirty || !revision)
            ? await save()
            : revision;
        if (!savedRevision) return;
        const result = await publishDesign(
          store.id,
          savedRevision,
          operation === "publish",
        );
        if (result.error) {
          setError(result.error);
          return;
        }
        setPublishedRevision(operation === "publish" ? savedRevision : null);
        setMessage(result.success!);
      } catch {
        setError(
          "Не вдалося виконати дію. Перевірте з’єднання та спробуйте ще раз.",
        );
      }
    });
  }
  function upload(file: File | undefined) {
    if (!file) return;
    const selectedId = selected;
    setError("");
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("image", file);
        const result = await uploadDesignImage(store.id, data);
        if (result.error) {
          setError(result.error);
          return;
        }
        setPast((current) => [...current.slice(-29), design]);
        setFuture([]);
        setDesign((current) => ({
          ...current,
          sections: current.sections.map((s) =>
            s.id === selectedId ? { ...s, imageUrl: result.imageUrl! } : s,
          ),
        }));
        setMessage("Фото завантажено. Збережіть оформлення.");
      } catch {
        setError("Не вдалося завантажити фото. Спробуйте ще раз.");
      }
    });
  }
  function addBlock(type: SectionType) {
    const next = newSection(type);
    change({ ...design, sections: [...design.sections, next] });
    setSelected(next.id);
  }
  return (
    <div className="design-workspace">
      <div className="design-toolbar">
        <div>
          <p className="eyebrow">ОФОРМЛЕННЯ МАГАЗИНУ</p>
          <h1>{store.name}</h1>
          <p className="muted" role="status">
            {pending
              ? "Зберігаємо…"
              : dirty
                ? "Є незбережені зміни"
                : revision
                  ? "Чернетку збережено"
                  : "Оберіть тему та збережіть оформлення"}{" "}
            ·{" "}
            {publishedRevision === null
              ? "Не опубліковано"
              : publishedRevision === revision && !dirty
                ? "Опубліковано"
                : "Є зміни для публікації"}
          </p>
        </div>
        <div className="design-toolbar-actions">
          <label className="consent-label">
            <input
              type="checkbox"
              checked={autosave}
              disabled={!editable || pending}
              onChange={(e) => setAutosave(e.target.checked)}
            />
            Автозбереження чернетки
          </label>
          {publishedRevision !== null && (
            <a
              className="button secondary"
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              Відкрити магазин
            </a>
          )}
          <button
            className="button secondary"
            disabled={!editable || pending || (!dirty && revision > 0)}
            onClick={() => perform("save")}
          >
            Зберегти чернетку
          </button>
          <button
            className="button"
            disabled={
              !canPublish ||
              pending ||
              (publishedRevision === revision && !dirty)
            }
            onClick={() => perform("publish")}
          >
            Опублікувати
          </button>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {versions.length > 0 && editable && (
        <div className="design-toolbar-actions">
          <label className="field">
            Історія оформлення
            <select
              value={versionToLoad}
              onChange={(e) => setVersionToLoad(e.target.value)}
              disabled={pending}
            >
              <option value="">Оберіть збережену версію</option>
              {versions.map((v) => (
                <option key={v.revision} value={v.revision}>
                  Версія {v.revision} ·{" "}
                  {new Date(v.created_at).toLocaleString("uk-UA", {
                    timeZone: "Europe/Kyiv",
                  })}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary"
            disabled={pending || !versionToLoad}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await loadDesignVersion(
                    store.id,
                    Number(versionToLoad),
                  );
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  if (result.design) {
                    setPast((current) => [...current.slice(-29), design]);
                    setFuture([]);
                    setDesign(result.design);
                    setError("");
                    setMessage(
                      "Версію завантажено в редактор. Збережіть і опублікуйте окремо.",
                    );
                  }
                } catch {
                  setError("Не вдалося відкрити збережену версію");
                }
              })
            }
          >
            Завантажити в редактор
          </button>
          <small>
            Зберігаються останні 30 версій. Список оновлюється після
            перезавантаження.
          </small>
        </div>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {!editable && (
        <p className="notice">Ваша роль дозволяє перегляд оформлення.</p>
      )}
      <div className="design-columns">
        <aside className="design-controls" aria-label="Налаштування оформлення">
          <div
            className="design-tabs"
            role="tablist"
            aria-label="Розділи редактора"
          >
            {(["themes", "brand", "blocks"] as const).map((value) => (
              <button
                key={value}
                id={`tab-${value}`}
                role="tab"
                aria-selected={tab === value}
                aria-controls={`panel-${value}`}
                onClick={() => setTab(value)}
              >
                {value === "themes"
                  ? "Теми"
                  : value === "brand"
                    ? "Бренд"
                    : "Блоки"}
              </button>
            ))}
          </div>
          <fieldset
            className="design-panel"
            disabled={!editable || pending}
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
          >
            {tab === "themes" && (
              <>
                <h2>Обери основу</h2>
                <p className="muted">
                  Зміна теми збереже тексти й блоки та застосує нові кольори й
                  шрифт.
                </p>
                {themeIds.map((id) => (
                  <button
                    type="button"
                    className={`theme-option ${design.theme === id ? "is-selected" : ""}`}
                    key={id}
                    aria-pressed={design.theme === id}
                    onClick={() => change(applyTheme(design, id))}
                  >
                    <span
                      className={`theme-swatch theme-swatch-${id}`}
                      style={{
                        background: themes[id].background,
                        color: themes[id].foreground,
                      }}
                      aria-hidden="true"
                    >
                      <span className="swatch-heading">
                        {id === "street"
                          ? "YOUR / STYLE"
                          : id === "boutique"
                            ? "La collection"
                            : "Everyday essentials"}
                      </span>
                      <span
                        className="swatch-line"
                        style={{ background: themes[id].accent }}
                      />
                      <span className="swatch-grid">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                    <strong>
                      {themes[id].name}
                      {design.theme === id ? " · Обрано" : ""}
                    </strong>
                    <span>{themes[id].description}</span>
                  </button>
                ))}
              </>
            )}
            {tab === "brand" && (
              <>
                <h2>Твій бренд</h2>
                <label className="field">
                  Назва на вітрині
                  <input
                    value={design.brandName}
                    maxLength={120}
                    onChange={(e) => field("brandName", e.target.value)}
                  />
                </label>
                <label className="field">
                  Рядок оголошення
                  <input
                    value={design.announcement}
                    maxLength={180}
                    placeholder="Наприклад: Нова колекція вже тут"
                    onChange={(e) => field("announcement", e.target.value)}
                  />
                </label>
                <div className="design-colors">
                  {(["background", "foreground", "accent"] as const).map(
                    (key) => (
                      <label className="field" key={key}>
                        {key === "background"
                          ? "Фон"
                          : key === "foreground"
                            ? "Текст"
                            : "Акцент"}
                        <input
                          type="color"
                          value={design[key]}
                          onChange={(e) => field(key, e.target.value)}
                        />
                      </label>
                    ),
                  )}
                </div>
                <label className="field">
                  Шрифт
                  <select
                    value={design.font}
                    onChange={(e) =>
                      field("font", e.target.value as Design["font"])
                    }
                  >
                    <option value="sans">Сучасний без засічок</option>
                    <option value="serif">Класичний із засічками</option>
                  </select>
                </label>
                <label className="field">
                  Email для покупців
                  <input
                    type="email"
                    value={design.email}
                    maxLength={254}
                    onChange={(e) => field("email", e.target.value)}
                  />
                </label>
                <label className="field">
                  Телефон для покупців
                  <input
                    type="tel"
                    value={design.phone}
                    maxLength={40}
                    onChange={(e) => field("phone", e.target.value)}
                  />
                </label>
              </>
            )}
            {tab === "blocks" && (
              <>
                <h2>Блоки сторінки</h2>
                <p className="muted">
                  Перетягніть блок або змініть порядок кнопками ↑ ↓. Натисніть
                  блок на вітрині, щоб редагувати.
                </p>
                <ol className="design-block-list">
                  {design.sections.map((section, index) => (
                    <li
                      key={section.id}
                      className={selected === section.id ? "is-selected" : ""}
                      draggable={editable && !pending}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", section.id);
                        setDragged(section.id);
                      }}
                      onDragEnd={() => setDragged(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragged)
                          change({
                            ...design,
                            sections: moveSection(
                              design.sections,
                              dragged,
                              index,
                            ),
                          });
                        setDragged(null);
                      }}
                    >
                      <button
                        type="button"
                        className="block-select"
                        onClick={() => setSelected(section.id)}
                        aria-pressed={selected === section.id}
                      >
                        {sectionNames[section.type]}
                        {!section.enabled && <small>Приховано</small>}
                      </button>
                      <button
                        type="button"
                        className="block-move"
                        aria-label={`Підняти ${sectionNames[section.type]}`}
                        disabled={index === 0}
                        onClick={() =>
                          change({
                            ...design,
                            sections: moveSection(
                              design.sections,
                              section.id,
                              index - 1,
                            ),
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="block-move"
                        aria-label={`Опустити ${sectionNames[section.type]}`}
                        disabled={index === design.sections.length - 1}
                        onClick={() =>
                          change({
                            ...design,
                            sections: moveSection(
                              design.sections,
                              section.id,
                              index + 1,
                            ),
                          })
                        }
                      >
                        ↓
                      </button>
                    </li>
                  ))}
                </ol>
                {design.sections.length < sectionTypes.length && (
                  <label className="field">
                    Додати блок
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value)
                          addBlock(e.target.value as SectionType);
                      }}
                    >
                      <option value="">Оберіть блок</option>
                      {sectionTypes
                        .filter(
                          (type) =>
                            !design.sections.some((s) => s.type === type),
                        )
                        .map((type) => (
                          <option value={type} key={type}>
                            {sectionNames[type]}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {selectedBlock && (
                  <div className="block-properties">
                    <h3>{sectionNames[selectedBlock.type]}</h3>
                    <label className="design-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedBlock.enabled}
                        onChange={(e) =>
                          blockField("enabled", e.target.checked)
                        }
                      />
                      Показувати блок
                    </label>
                    <label className="field">
                      Заголовок блоку
                      <input
                        value={selectedBlock.title}
                        maxLength={120}
                        onChange={(e) => blockField("title", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Текст блоку
                      <textarea
                        rows={4}
                        value={selectedBlock.text}
                        maxLength={1200}
                        onChange={(e) => blockField("text", e.target.value)}
                      />
                    </label>
                    {selectedBlock.type === "hero" && (
                      <>
                        <label className="field">
                          Текст кнопки
                          <input
                            value={selectedBlock.buttonLabel}
                            maxLength={40}
                            onChange={(e) =>
                              blockField("buttonLabel", e.target.value)
                            }
                          />
                        </label>
                        <label className="field">
                          Фото банера · до 5 МБ
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                              upload(e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {selectedBlock.imageUrl && (
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => blockField("imageUrl", "")}
                          >
                            Прибрати фото банера
                          </button>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      className="design-remove"
                      disabled={design.sections.length === 1}
                      onClick={() => {
                        change({
                          ...design,
                          sections: design.sections.filter(
                            (s) => s.id !== selected,
                          ),
                        });
                        setSelected(
                          design.sections.find((s) => s.id !== selected)!.id,
                        );
                      }}
                    >
                      Видалити блок
                    </button>
                  </div>
                )}
              </>
            )}
          </fieldset>
          {canPublish && publishedRevision !== null && (
            <button
              className="design-remove"
              disabled={pending}
              onClick={() => perform("unpublish")}
            >
              Зняти магазин з публікації
            </button>
          )}
        </aside>
        <div className="design-preview-area">
          <div className="preview-toolbar">
            <div className="preview-devices" aria-label="Розмір перегляду">
              <button
                aria-pressed={device === "desktop"}
                onClick={() => setDevice("desktop")}
              >
                Комп’ютер
              </button>
              <button
                aria-pressed={device === "mobile"}
                onClick={() => setDevice("mobile")}
              >
                Телефон
              </button>
            </div>
            <div>
              <button
                disabled={!past.length || !editable || pending}
                onClick={undo}
                aria-label="Скасувати зміну"
              >
                ↶
              </button>
              <button
                disabled={!future.length || !editable || pending}
                onClick={redo}
                aria-label="Повторити зміну"
              >
                ↷
              </button>
            </div>
          </div>
          <p className="preview-note">
            Попередній перегляд
            {!products.length
              ? " · Демонстраційні товари; вони не публікуються. Додайте активні товари в каталог."
              : " · Показано активні товари з вашого каталогу."}
          </p>
          <div
            className={`design-preview-frame preview-${device}`}
            data-testid="storefront-preview"
            onClickCapture={(event) => {
              if ((event.target as HTMLElement).closest("a"))
                event.preventDefault();
            }}
          >
            <Storefront
              design={design}
              store={store}
              products={products.length ? products : demoProducts}
              categories={categories.length ? categories : demoCategories}
              preview
              selectedSection={selected}
              onSelectSection={(id) => {
                setSelected(id);
                setTab("blocks");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
