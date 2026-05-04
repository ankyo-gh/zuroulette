import { useEffect, useRef, useState } from "react";
import {
  CaretDownIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";

type RouletteItem = {
  id: string;
  label: string;
  color: string;
};

type MotionSettings = {
  durationMs: number;
  easing: string;
};

const TEXT = {
  title: "ズルーレット",
  target: "ターゲット項目",
  result: "結果",
  resultCaption: "選ばれた項目",
  spin: "スタート",
  spinning: "回転中...",
  revealing: "終了",
  reset: "リセット",
  items: "項目",
  addItem: "項目を追加",
  color: "色",
  none: "未選択",
  pending: "\u2014",
  delete: "削除",
  close: "閉じる",
};

const COLOR_PRESETS = [
  "#e76f51",
  "#f4a261",
  "#e9c46a",
  "#2a9d8f",
  "#457b9d",
  "#7b2cbf",
  "#d62828",
  "#ff7f51",
];

const DEFAULT_ITEMS: RouletteItem[] = [
  { id: "dflt-1", label: "", color: "#e76f51" },
  { id: "dflt-2", label: "", color: "#f4a261" },
  { id: "dflt-3", label: "", color: "#e9c46a" },
  { id: "dflt-4", label: "", color: "#2a9d8f" },
  { id: "dflt-5", label: "", color: "#457b9d" },
  { id: "dflt-6", label: "", color: "#7b2cbf" },
];

const RESULT_REVEAL_DELAY_MS = 320;

function createItem(label: string, color: string): RouletteItem {
  return {
    id: `item-${Math.random().toString(36).slice(2, 10)}`,
    label,
    color,
  };
}

function normalizeRotation(value: number) {
  return ((value % 360) + 360) % 360;
}

function clockwiseDistance(from: number, to: number) {
  return (normalizeRotation(to) - normalizeRotation(from) + 360) % 360;
}

function counterClockwiseDistance(from: number, to: number) {
  return (normalizeRotation(from) - normalizeRotation(to) + 360) % 360;
}

function shortestRotationDelta(from: number, to: number) {
  const clockwise = clockwiseDistance(from, to);
  const counterClockwise = counterClockwiseDistance(from, to);

  return clockwise <= counterClockwise ? clockwise : -counterClockwise;
}

function getAlignmentForIndex(index: number, count: number) {
  const segmentAngle = 360 / count;
  return -(index * segmentAngle + segmentAngle / 2);
}

function getLabel(item: RouletteItem, index: number) {
  const trimmed = item.label.trim();
  return trimmed.length > 0 ? trimmed : String(index + 1);
}

function polarPosition(angleDeg: number, radius: number) {
  const radians = (angleDeg * Math.PI) / 180;

  return {
    x: 50 + Math.sin(radians) * radius,
    y: 50 - Math.cos(radians) * radius,
  };
}

function describeSlicePath(
  startAngle: number,
  endAngle: number,
  radius: number,
) {
  const start = polarPosition(startAngle, radius);
  const end = polarPosition(endAngle, radius);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return `M 50 50 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

function App() {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<RouletteItem[]>(DEFAULT_ITEMS);
  const [targetId, setTargetId] = useState(DEFAULT_ITEMS[0].id);
  const [resultId, setResultId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [motion, setMotion] = useState<MotionSettings>({
    durationMs: 0,
    easing: "linear",
  });
  const [isSpinning, setIsSpinning] = useState(false);
  const [isResultPending, setIsResultPending] = useState(false);
  const timeoutIdsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  const segmentAngle = 360 / items.length;
  const targetIndex = items.findIndex((item) => item.id === targetId);
  const resultIndex = resultId
    ? items.findIndex((item) => item.id === resultId)
    : -1;
  const resultItem = resultIndex >= 0 ? items[resultIndex] : null;
  const isBusy = isSpinning || isResultPending;
  const canSpin = items.length > 1 && targetIndex >= 0 && !isBusy;

  function clearSpinTimers() {
    timeoutIdsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    timeoutIdsRef.current = [];
  }

  function schedule(step: () => void, delayMs: number) {
    const timeoutId = window.setTimeout(step, delayMs);
    timeoutIdsRef.current.push(timeoutId);
  }

  useEffect(() => {
    if (!resultItem) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setResultId(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [resultItem]);

  function updateItem(id: string, patch: Partial<RouletteItem>) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  }

  function addItem() {
    const nextIndex = items.length;
    const nextItem = createItem(
      "",
      COLOR_PRESETS[nextIndex % COLOR_PRESETS.length],
    );

    setItems((currentItems) => [...currentItems, nextItem]);
  }

  function removeItem(id: string) {
    if (items.length <= 2) {
      return;
    }

    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);

    if (targetId === id) {
      setTargetId(nextItems[0]?.id ?? "");
    }

    if (resultId === id) {
      setResultId(null);
    }
  }

  function resetItems() {
    clearSpinTimers();
    setItems(DEFAULT_ITEMS);
    setTargetId(DEFAULT_ITEMS[0].id);
    setResultId(null);
    setRotation(0);
    setMotion({ durationMs: 0, easing: "linear" });
    setIsSpinning(false);
    setIsResultPending(false);
  }

  function closeResultModal() {
    setResultId(null);
  }

  function spinRiggedWheel() {
    if (!canSpin) {
      return;
    }

    clearSpinTimers();

    const forwardDurationMs = 5000;
    const reverseLeadMs = 500;
    const reverseDurationMs = 200;
    const forcedTargetIndex = items.findIndex((item) => item.id === targetId);
    const wrongOffset = 1 + Math.floor(Math.random() * (items.length - 1));
    const fakeStopIndex = (forcedTargetIndex + wrongOffset) % items.length;
    const fakeStopAlignment = getAlignmentForIndex(fakeStopIndex, items.length);
    const forcedAlignment = getAlignmentForIndex(
      forcedTargetIndex,
      items.length,
    );
    const stageOneRotation =
      rotation +
      360 * (5 + Math.floor(Math.random() * 2)) +
      clockwiseDistance(rotation, fakeStopAlignment);
    const stageTwoRotation =
      stageOneRotation +
      shortestRotationDelta(stageOneRotation, forcedAlignment);

    setIsSpinning(true);
    setIsResultPending(false);
    setResultId(null);
    setMotion({
      durationMs: forwardDurationMs,
      easing: "cubic-bezier(0.12, 0.92, 0.18, 1)",
    });
    setRotation(stageOneRotation);

    schedule(() => {
      setMotion({
        durationMs: reverseDurationMs,
        easing: "cubic-bezier(0.7, -0.12, 0.3, 1)",
      });
      setRotation(stageTwoRotation);
    }, forwardDurationMs - reverseLeadMs);

    schedule(
      () => {
        setIsSpinning(false);
        setIsResultPending(true);
      },
      forwardDurationMs - reverseLeadMs + reverseDurationMs,
    );

    schedule(
      () => {
        setResultId(targetId);
        setIsResultPending(false);
      },
      forwardDurationMs -
        reverseLeadMs +
        reverseDurationMs +
        RESULT_REVEAL_DELAY_MS,
    );
  }

  return (
    <>
      <div className="flex min-h-screen flex-col bg-slate-50 text-zinc-800">
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <header className="px-6 py-6 sm:px-8">
              <div className="flex justify-center">
                <h1 className="font-bold text-4xl leading-none sm:text-5xl text-center">
                  {title.trim() || TEXT.title}
                </h1>
              </div>
            </header>

            <div className="grid gap-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <section className="panel relative overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
                  <div className="pointer-events-none relative mx-auto aspect-square w-full max-w-140 select-none">
                    <div className="absolute left-1/2 -top-1 z-20 -translate-x-1/2">
                      <div className="mx-auto -mt-1 h-0 w-0 border-x-18 border-t-34 border-x-transparent border-t-red-500 drop-shadow-lg" />
                    </div>

                    <div className="absolute inset-0 rounded-full bg-stone-200" />

                    <div
                      className="absolute inset-0 overflow-hidden rounded-full"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        transitionProperty: "transform",
                        transitionDuration: `${motion.durationMs}ms`,
                        transitionTimingFunction: motion.easing,
                      }}
                    >
                      <svg
                        className="absolute inset-0 h-full w-full"
                        viewBox="0 0 100 100"
                        aria-hidden="true"
                      >
                        {items.map((item, index) => {
                          const startAngle = index * segmentAngle;
                          const endAngle = (index + 1) * segmentAngle;

                          return (
                            <path
                              key={`${item.id}-slice`}
                              d={describeSlicePath(startAngle, endAngle, 49)}
                              fill={item.color}
                              stroke="#ffffff"
                              strokeWidth="0.5"
                              strokeLinejoin="round"
                            />
                          );
                        })}

                        <circle
                          cx="50"
                          cy="50"
                          r="49"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="0.5"
                        />
                      </svg>

                      {items.map((item, index) => {
                        const angle = index * segmentAngle + segmentAngle / 2;
                        const radialRotation = angle - 90;
                        const { x, y } = polarPosition(angle, 10);

                        return (
                          <div
                            key={item.id}
                            className="absolute"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              transform: "translateY(-50%)",
                            }}
                          >
                            <div
                              style={{
                                transform: `rotate(${radialRotation}deg)`,
                                transformOrigin: "left center",
                              }}
                            >
                              <div className="w-28 overflow-hidden text-ellipsis whitespace-nowrap rounded-full text-right font-black tracking-[0.12em] text-white sm:w-45 sm:text-xl">
                                {getLabel(item, index)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="absolute inset-[45%] rounded-full bg-white shadow-xl" />
                  </div>

                  <div className="relative z-10 mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={spinRiggedWheel}
                      disabled={!canSpin}
                      className="action-button bg-slate-600 px-6 text-white hover:bg-slate-700 items-center gap-2 text-xl"
                    >
                      {isBusy ? null : <PlayIcon size={20} weight="fill" />}

                      <span>
                        {isSpinning
                          ? TEXT.spinning
                          : isResultPending
                            ? TEXT.revealing
                            : TEXT.spin}
                      </span>
                    </button>
                  </div>
                </section>

                <aside className="grid gap-6">
                  <section className="panel px-5 py-6 sm:px-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-bold">{TEXT.items}</h2>
                      </div>

                      <div className="space-y-3">
                        {items.map((item, index) => {
                          return (
                            <div className="flex items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <input
                                  type="text"
                                  value={item.label}
                                  onChange={(event) =>
                                    updateItem(item.id, {
                                      label: event.target.value,
                                    })
                                  }
                                  disabled={isBusy}
                                  className="field"
                                  placeholder={`${index + 1}`}
                                />
                              </div>

                              <div className="shrink-0 size-8 aspect-square rounded-lg">
                                <input
                                  type="color"
                                  className="size-full cursor-pointer appearance-none"
                                  value={item.color}
                                  onChange={(event) =>
                                    updateItem(item.id, {
                                      color: event.target.value,
                                    })
                                  }
                                  disabled={isBusy}
                                  aria-label={`${getLabel(item, index)} ${TEXT.color}`}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                disabled={isBusy || items.length <= 2}
                                className="action-button h-11 w-11 p-0 shrink-0 text-lg text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                                aria-label={`${getLabel(item, index)} ${TEXT.delete}`}
                              >
                                <TrashIcon size={24} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-6 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={addItem}
                          disabled={isBusy}
                          className="action-button bg-slate-600 text-white hover:bg-slate-700 items-center gap-2"
                        >
                          <PlusIcon weight="bold" size={16} />
                          <span>{TEXT.addItem}</span>
                        </button>

                        <button
                          type="button"
                          onClick={resetItems}
                          disabled={isBusy}
                          className="action-button border border-stone-900/10 bg-white text-stone-700 hover:bg-stone-50"
                        >
                          {TEXT.reset}
                        </button>
                      </div>

                      <div>
                        <h2 className="text-xl font-bold">{TEXT.target}</h2>
                        <div className="relative mt-2">
                          <select
                            value={targetId}
                            onChange={(event) =>
                              setTargetId(event.target.value)
                            }
                            disabled={isBusy}
                            className="field appearance-none pr-11"
                          >
                            {items.map((item, index) => (
                              <option key={item.id} value={item.id}>
                                {getLabel(item, index)}
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-400">
                            <CaretDownIcon />
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="panel px-5 py-6 sm:px-6">
                    <div>
                      <h2 className="text-xl font-bold">タイトル</h2>
                      <div className="mt-2">
                        <input
                          type="text"
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          disabled={isBusy}
                          className="field"
                          placeholder={TEXT.title}
                        />
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
              <section className="panel px-5 py-6 sm:px-6">
                <h2 className="text-xl font-bold">ズルーレットについて</h2>
                <div>
                  <div className="mt-2.5 space-y-2.5">
                    <p>
                      ズルーレットは、露骨にズルいルーレットを誰でも簡単に作れるサービスです。
                    </p>
                    <p>
                      YouTube配信や飲み会など、様々な場面でご利用いただけます。
                    </p>
                    <p>
                      ※本サービスは演出・ジョーク用に作成されたものです。実際の抽選、有価物を伴う決定、参加者に公平性を期待させる場面では使用しないでください。
                    </p>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-bold">使い方</h3>
                    <div className="mt-2.5 space-y-2.5">
                      <p>
                        最初から準備されている項目の名前を変更したり、項目を追加したりして、ルーレットをカスタマイズできます。
                      </p>
                      <p>
                        項目名の右にある色アイコンを押すと、項目の色を変更できます。その右隣にあるゴミ箱ボタンを押すと、項目を削除できます。
                      </p>
                      <p>
                        リセットボタンを押すと、入力内容がすべてリセットされ、初期状態に戻ります。
                      </p>
                      <p>
                        タイトルを入力すると、画面上部に表示されているタイトルを「ズルーレット」から変更できます。
                      </p>
                      <p>
                        スタートボタンを押すとルーレットが回転。一度フェイントをかけてから、ターゲット項目で停止します。
                      </p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <h3 className="text-lg font-bold">お問い合わせ</h3>
                    <p className="mt-2.5">
                      ご意見・ご要望は開発者X(
                      <a
                        href="https://x.com/ankyo_gh"
                        className="hover:underline text-blue-500"
                      >
                        @ankyo_gh
                      </a>
                      )までご連絡ください。
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>

        <footer className="bg-slate-600 px-4 py-4 text-center text-sm text-white">
          © 2026 ankyo
        </footer>
      </div>

      {resultItem ? (
        <div
          className="result-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8"
          onClick={closeResultModal}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="result-modal-title"
            className="result-modal relative w-full max-w-2xl overflow-hidden rounded-4xl bg-white p-6 shadow-2xl sm:p-10"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
                {TEXT.result}
              </p>

              <h2
                id="result-modal-title"
                className="mt-5 wrap-break-word text-5xl font-black leading-tight sm:text-7xl"
              >
                {getLabel(resultItem, resultIndex)}
              </h2>

              <button
                type="button"
                onClick={closeResultModal}
                className="action-button mt-8 bg-slate-600 px-8 text-white hover:bg-slate-700"
              >
                {TEXT.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default App;
