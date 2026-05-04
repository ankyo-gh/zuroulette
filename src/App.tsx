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
  spin: "スタート",
  spinning: "回転中...",
  reset: "リセット",
  items: "項目",
  addItem: "項目を追加",
  color: "色",
  none: "未選択",
  pending: "\u2014",
  delete: "削除",
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
  const canSpin = items.length > 1 && targetIndex >= 0 && !isSpinning;

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
        setResultId(targetId);
        setIsSpinning(false);
      },
      forwardDurationMs - reverseLeadMs + reverseDurationMs,
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-zinc-800 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="px-6 py-6 sm:px-8">
          <div className="flex justify-center">
            <h1 className="font-bold text-4xl leading-none sm:text-5xl text-center">
              {title.trim() || TEXT.title}
            </h1>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="panel relative overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
            <div className="relative mx-auto aspect-square w-full max-w-140">
              <div className="absolute left-1/2 -top-1 z-20 -translate-x-1/2">
                <div className="mx-auto -mt-1 h-0 w-0 border-x-18 border-t-34 border-x-transparent border-t-red-500" />
              </div>

              <div className="absolute inset-0 rounded-full bg-stone-200" />

              <div
                className="absolute inset-0 rounded-full"
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
                        <div className="w-30 overflow-hidden text-ellipsis whitespace-nowrap rounded-full text-right font-black tracking-[0.12em] text-white sm:w-45 sm:text-xl">
                          {getLabel(item, index)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="absolute inset-[45%] rounded-full bg-white shadow-xl" />
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={spinRiggedWheel}
                disabled={!canSpin}
                className="action-button bg-slate-600 px-6 text-white hover:bg-slate-700 items-center gap-2 text-xl"
              >
                {isSpinning ? null : <PlayIcon size={20} weight="fill" />}

                <span>{isSpinning ? TEXT.spinning : TEXT.spin}</span>
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
                              updateItem(item.id, { label: event.target.value })
                            }
                            disabled={isSpinning}
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
                              updateItem(item.id, { color: event.target.value })
                            }
                            disabled={isSpinning}
                            aria-label={`${getLabel(item, index)} ${TEXT.color}`}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={isSpinning || items.length <= 2}
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
                    disabled={isSpinning}
                    className="action-button bg-slate-600 text-white hover:bg-slate-700 items-center gap-2"
                  >
                    <PlusIcon weight="bold" size={16} />
                    <span>{TEXT.addItem}</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetItems}
                    disabled={isSpinning}
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
                      onChange={(event) => setTargetId(event.target.value)}
                      disabled={isSpinning}
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
                    disabled={isSpinning}
                    className="field"
                    placeholder={TEXT.title}
                  />
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default App;
