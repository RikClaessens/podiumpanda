import { useLanguage } from "../lib/language";
import { useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Stage, Text, Line, Transformer } from "react-konva";
import type Konva from "konva";
import { Download, Locate, Plus, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useTheme } from "next-themes";
import { ofKind, type OfKind } from "../../shared/model";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Picker } from "./picker";
import { DeleteButton, type EditorProps } from "./editors";
import { EditToggle } from "./edit-toggle";
import {
  clampView,
  defaultView,
  maxZoom,
  minZoom,
  transformFloorObject,
  worldBounds,
  worldRect,
} from "../lib/floorplan-geometry";
type StageObject = OfKind<"object">;
const objectLabels = {
  chair: "Chair",
  stand: "Stand",
  label: "Label",
  square: "Square",
  rectangle: "Rectangle",
  instrument: "Melodic instrument",
} satisfies Record<StageObject["type"], string>;
const objectSizes = {
  chair: { width: 50, height: 50 },
  stand: { width: 50, height: 50 },
  label: { width: 160, height: 30 },
  square: { width: 80, height: 80 },
  rectangle: { width: 140, height: 80 },
  instrument: { width: 180, height: 70 },
} satisfies Record<StageObject["type"], { width: number; height: number }>;
const canvasPalettes = {
  light: {
    background: "#ffffff",
    grid: "#eadcf3",
    text: "#4b1d8b",
    chair: "#c9a6ff",
    stand: "#f7c94b",
    shape: "#eee1ff",
    stroke: "#8f63d9",
  },
  dark: {
    background: "#20122e",
    grid: "#392547",
    text: "#fff5e1",
    chair: "#583681",
    stand: "#655422",
    shape: "#493258",
    stroke: "#c9a6ff",
  },
};
type CanvasPalette = typeof canvasPalettes.light;
export default function Floorplans({
  snapshot,
  busy,
  onEdit,
  onPlanChange,
  selectedPlanId,
}: EditorProps & {
  onPlanChange?: (id: string | null) => void;
  selectedPlanId?: string | null;
}) {
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const colors = resolvedTheme === "dark" ? canvasPalettes.dark : canvasPalettes.light;
  const plans = ofKind(snapshot, "floorplan");
  const [chosen, setChosen] = useState<string | null>(snapshot.concert.defaultFloorplanId);
  const activeChoice = selectedPlanId === undefined ? chosen : selectedPlanId;
  const planId = plans.some((plan) => plan.id === activeChoice)
    ? activeChoice
    : (plans[0]?.id ?? null);
  const plan = plans.find((item) => item.id === planId);
  const objects = ofKind(snapshot, "object").filter((item) => item.floorplanId === planId);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [adding, setAdding] = useState(false);
  const [rename, setRename] = useState<{
    planId: string;
    value: string;
    revision: number;
  } | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [width, setWidth] = useState(800);
  const wrapper = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const [view, setView] = useState(defaultView);
  const baseScale = width / 1000;
  const stageScale = baseScale * view.zoom;
  const stagePosition = {
    x: width / 2 - view.cx * stageScale,
    y: (width * 0.6) / 2 - view.cy * stageScale,
  };
  const zoomAt = (factor: number, screen = { x: width / 2, y: (width * 0.6) / 2 }) => {
    const oldScale = stageScale;
    const zoom = Math.max(minZoom, Math.min(maxZoom, view.zoom * factor));
    const newScale = baseScale * zoom;
    const worldX = (screen.x - stagePosition.x) / oldScale;
    const worldY = (screen.y - stagePosition.y) / oldScale;
    setView(
      clampView({
        zoom,
        cx: (width / 2 - (screen.x - worldX * newScale)) / newScale,
        cy: ((width * 0.6) / 2 - (screen.y - worldY * newScale)) / newScale,
      }),
    );
  };
  useEffect(() => {
    if (!wrapper.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, []);
  const selected = objects.find((item) => item.id === selection);
  const activeRename = rename?.planId === planId ? rename : null;
  const playerNames = new Map(ofKind(snapshot, "player").map((player) => [player.id, player.name]));
  async function addObject(type: StageObject["type"]) {
    if (!planId) return;
    const id = crypto.randomUUID();
    const largeShapeLayout =
      type === "square" ||
      type === "rectangle" ||
      type === "instrument" ||
      objects.some((object) => ["square", "rectangle", "instrument"].includes(object.type));
    if (
      await onEdit({
        type: "put",
        entity: {
          kind: "object",
          id,
          floorplanId: planId,
          type,
          x: largeShapeLayout ? 100 + (objects.length % 4) * 200 : 100 + (objects.length % 10) * 65,
          y: largeShapeLayout
            ? 120 + (Math.floor(objects.length / 4) % 4) * 100
            : 120 + (Math.floor(objects.length / 10) % 5) * 70,
          ...objectSizes[type],
          rotation: 0,
          label: type === "label" ? t("Stage label") : "",
          playerId: null,
          partId: null,
        },
      })
    )
      setSelection(id);
  }
  return (
    <section className="space-y-4">
      <div className="panel flex flex-wrap items-end gap-3">
        <div className="field min-w-0 max-w-full">
          <label htmlFor="floorplan-choice">{t("Floorplan")}</label>
          <Picker
            id="floorplan-choice"
            className="max-w-full"
            value={planId ?? ""}
            onValueChange={(value) => {
              setChosen(value);
              setSelection(null);
              setRename(null);
              onPlanChange?.(value || null);
            }}
            options={
              plans.length
                ? plans.map((item) => ({ value: item.id, label: item.name }))
                : [{ value: "", label: t("No floorplans yet") }]
            }
          />
        </div>
        <Button
          type="button"
          variant={plans.length ? "outline" : "default"}
          onClick={() => setAdding(!adding)}
        >
          <Plus size={16} />
          {adding ? t("Cancel") : t("Add floorplan")}
        </Button>
        {plan && (
          <EditToggle
            editing={editing}
            editLabel={t("Edit floorplan")}
            onClick={() => {
              setEditing(!editing);
              setSelection(null);
            }}
          />
        )}
        {adding && (
          <form
            className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center"
            onSubmit={async (event) => {
              event.preventDefault();
              const id = crypto.randomUUID();
              if (await onEdit({ type: "put", entity: { kind: "floorplan", id, name } })) {
                setChosen(id);
                onPlanChange?.(id);
                setName("");
                setRename(null);
                setAdding(false);
                setEditing(true);
              }
            }}
          >
            <Input
              aria-label={t("New floorplan name")}
              className="sm:w-52"
              placeholder={t("Another stage setup")}
              required
              maxLength={160}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button variant="outline" disabled={busy}>
              <Plus size={16} />
              {t("Floorplan")}
            </Button>
          </form>
        )}
        {plan && editing && (
          <div className="flex min-w-0 max-w-full flex-wrap gap-2 sm:ml-auto">
            {activeRename ? (
              <form
                className="flex min-w-0 flex-wrap gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (
                    await onEdit(
                      { type: "put", entity: { ...plan, name: activeRename.value } },
                      activeRename.revision,
                    )
                  )
                    setRename(null);
                }}
              >
                <Input
                  aria-label={t("Rename floorplan")}
                  required
                  maxLength={160}
                  value={activeRename.value}
                  onChange={(event) => setRename({ ...activeRename, value: event.target.value })}
                />
                <Button disabled={busy}>{t("Save")}</Button>
                <Button type="button" variant="ghost" onClick={() => setRename(null)}>
                  {t("Cancel")}
                </Button>
              </form>
            ) : (
              <Button
                variant="ghost"
                onClick={() =>
                  setRename({
                    planId: plan.id,
                    value: plan.name,
                    revision: snapshot.concert.revision,
                  })
                }
              >
                {t("Rename")}
              </Button>
            )}
            <DeleteButton
              label={plan.name}
              busy={busy}
              onDelete={async () => {
                const deleted = await onEdit({ type: "delete", id: plan.id });
                if (deleted) {
                  setChosen(null);
                  onPlanChange?.(null);
                }
                return deleted;
              }}
            />
          </div>
        )}
      </div>
      <div className={editing ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]" : "grid gap-4"}>
        <div className="panel min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="section-title mr-auto min-w-0 max-w-full break-words">
              {plan?.name ?? t("Create a floorplan to begin")}
            </h2>
            {editing &&
              (["chair", "stand", "label", "square", "rectangle", "instrument"] as const).map(
                (type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant="outline"
                    disabled={busy || !planId}
                    onClick={() => addObject(type)}
                  >
                    <Plus size={14} />
                    {t(objectLabels[type])}
                  </Button>
                ),
              )}
            <Button
              size="sm"
              variant="outline"
              disabled={!planId}
              onClick={() => {
                if (!stage.current) return;
                const transformers = stage.current.find("Transformer");
                transformers.forEach((transformer) => transformer.hide());
                try {
                  const link = document.createElement("a");
                  link.download = "podiumpanda-floorplan.png";
                  link.href = stage.current.toDataURL({ pixelRatio: 2 });
                  link.click();
                } finally {
                  transformers.forEach((transformer) => transformer.show());
                }
              }}
            >
              <Download size={14} />
              PNG
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={showGrid}
                onCheckedChange={(checked) => setShowGrid(checked === true)}
              />
              {t("Show gridlines")}
            </label>
          </div>
          {editing && (
            <p className="text-xs text-muted-foreground">
              {t(
                "Audience at the bottom. Drag objects to move them; select one to resize or rotate it using the handles.",
              )}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              aria-label={t("Zoom in")}
              disabled={view.zoom >= maxZoom}
              onClick={() => zoomAt(1.25)}
            >
              <ZoomIn size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={t("Zoom out")}
              disabled={view.zoom <= minZoom}
              onClick={() => zoomAt(0.8)}
            >
              <ZoomOut size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setView(clampView({ ...view, cx: 500, cy: 300 }))}
            >
              <Locate size={14} />
              {t("Center")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setView(defaultView)}>
              <RotateCcw size={14} />
              {t("Reset zoom")}
            </Button>
            <span className="text-xs text-muted-foreground">{Math.round(view.zoom * 100)}%</span>
          </div>
          <div ref={wrapper} className="overflow-hidden rounded-lg border bg-card">
            <Stage
              ref={stage}
              width={width}
              height={width * 0.6}
              x={stagePosition.x}
              y={stagePosition.y}
              scaleX={stageScale}
              scaleY={stageScale}
              draggable
              dragBoundFunc={(position) => {
                const next = clampView({
                  zoom: view.zoom,
                  cx: (width / 2 - position.x) / stageScale,
                  cy: ((width * 0.6) / 2 - position.y) / stageScale,
                });
                return {
                  x: width / 2 - next.cx * stageScale,
                  y: (width * 0.6) / 2 - next.cy * stageScale,
                };
              }}
              onDragEnd={(event) => {
                const target = event.target;
                if (target !== target.getStage()) return;
                setView(
                  clampView({
                    zoom: view.zoom,
                    cx: (width / 2 - target.x()) / stageScale,
                    cy: ((width * 0.6) / 2 - target.y()) / stageScale,
                  }),
                );
              }}
              onWheel={(event) => {
                event.evt.preventDefault();
                const pointer = event.target.getStage()?.getPointerPosition();
                if (pointer) zoomAt(event.evt.deltaY < 0 ? 1.1 : 1 / 1.1, pointer);
              }}
              onMouseDown={(event) => {
                if (event.target === event.target.getStage()) setSelection(null);
              }}
              onTouchStart={(event) => {
                if (event.target === event.target.getStage()) setSelection(null);
              }}
            >
              <Layer>
                <Rect {...worldRect} fill={colors.background} listening={false} />
                {showGrid &&
                  Array.from({ length: 59 }, (_, i) => (
                    <Line
                      key={`x-${i}`}
                      points={[
                        (i - 19) * 50,
                        worldRect.y,
                        (i - 19) * 50,
                        worldRect.y + worldRect.height,
                      ]}
                      stroke={colors.grid}
                      listening={false}
                    />
                  ))}
                {showGrid &&
                  Array.from({ length: 35 }, (_, i) => (
                    <Line
                      key={`y-${i}`}
                      points={[
                        worldRect.x,
                        (i - 11) * 50,
                        worldRect.x + worldRect.width,
                        (i - 11) * 50,
                      ]}
                      stroke={colors.grid}
                      listening={false}
                    />
                  ))}
                <Text
                  x={worldRect.x}
                  y={worldRect.y + worldRect.height - 35}
                  width={worldRect.width}
                  align="center"
                  text={t("Audience").toUpperCase()}
                  fontSize={14}
                  fill={colors.text}
                  fontFamily="Montserrat Variable"
                  listening={false}
                />
                {objects.map((object) => (
                  <FloorObject
                    key={object.id}
                    object={object}
                    selected={object.id === selection}
                    label={
                      object.label ||
                      (object.playerId ? (playerNames.get(object.playerId) ?? "") : "")
                    }
                    onSelect={() => setSelection(object.id)}
                    colors={colors}
                    editing={editing}
                    canvasScale={stageScale}
                    {...{ snapshot, busy, onEdit }}
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        </div>
        {editing && (
          <aside className="panel min-w-0 space-y-4">
            <h3 className="font-semibold">{t("Object details")}</h3>
            {selected ? (
              <ObjectProperties
                key={selected.id}
                object={selected}
                {...{ snapshot, busy, onEdit }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("Select an object on stage or from the list below.")}
              </p>
            )}
            <div className="space-y-1 border-t pt-3">
              <h3 className="text-sm font-semibold">
                {objects.length}
                {" " + t("stage objects")}
              </h3>
              {objects.map((object, index) => (
                <Button
                  key={object.id}
                  type="button"
                  variant={object.id === selection ? "secondary" : "ghost"}
                  aria-pressed={object.id === selection}
                  className="h-auto w-full justify-start whitespace-normal break-all px-2 py-1 text-left text-sm"
                  onClick={() => setSelection(object.id)}
                >
                  {index + 1}. {t(objectLabels[object.type])}{" "}
                  {object.label || (object.playerId ? playerNames.get(object.playerId) : "")}
                </Button>
              ))}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
function FloorObject({
  object,
  selected,
  label,
  snapshot,
  busy,
  onEdit,
  onSelect,
  colors,
  editing,
  canvasScale,
}: EditorProps & {
  object: StageObject;
  selected: boolean;
  label: string;
  onSelect: () => void;
  colors: CanvasPalette;
  editing: boolean;
  canvasScale: number;
}) {
  const { t } = useLanguage();
  const drag = useRef({ entity: object, revision: snapshot.concert.revision });
  const node = useRef<Konva.Group>(null);
  const transformer = useRef<Konva.Transformer>(null);
  useEffect(() => {
    if (selected && editing && !busy && node.current && transformer.current) {
      transformer.current.nodes([node.current]);
      transformer.current.moveToTop();
      transformer.current.getLayer()?.batchDraw();
    }
  }, [selected, editing, busy]);
  return (
    <>
      <Group
        ref={node}
        x={object.x}
        y={object.y}
        rotation={object.rotation}
        draggable={editing && !busy}
        onClick={editing ? onSelect : undefined}
        onTap={editing ? onSelect : undefined}
        onDragStart={() => {
          drag.current = { entity: object, revision: snapshot.concert.revision };
          onSelect();
        }}
        onDragEnd={async (event) => {
          const target = event.target;
          const x = Math.max(worldBounds.minX, Math.min(worldBounds.maxX, target.x()));
          const y = Math.max(worldBounds.minY, Math.min(worldBounds.maxY, target.y()));
          target.position({ x, y });
          const success = await onEdit(
            { type: "put", entity: { ...drag.current.entity, x, y } },
            drag.current.revision,
          );
          if (!success) target.position({ x: object.x, y: object.y });
        }}
        onTransformStart={() => {
          drag.current = { entity: object, revision: snapshot.concert.revision };
        }}
        onTransformEnd={async () => {
          const target = node.current;
          if (!target) return;
          const previous = drag.current.entity;
          const next = transformFloorObject(previous, {
            x: target.x(),
            y: target.y(),
            scaleX: target.scaleX(),
            scaleY: target.scaleY(),
            rotation: target.rotation(),
          });
          target.scale({ x: 1, y: 1 });
          target.position({ x: next.x, y: next.y });
          target.rotation(next.rotation);
          const success = await onEdit({ type: "put", entity: next }, drag.current.revision);
          if (!success) {
            target.position({ x: previous.x, y: previous.y });
            target.rotation(previous.rotation);
          }
        }}
      >
        {object.type === "instrument" ? (
          <Line
            points={[
              0,
              object.height * 0.25,
              object.width,
              0,
              object.width,
              object.height,
              0,
              object.height * 0.75,
            ]}
            closed
            fill={colors.shape}
            stroke={colors.stroke}
            strokeWidth={1}
          />
        ) : (
          <Rect
            width={object.width}
            height={object.height}
            fill={
              object.type === "chair"
                ? colors.chair
                : object.type === "stand"
                  ? colors.stand
                  : object.type === "label"
                    ? "transparent"
                    : colors.shape
            }
            stroke={colors.stroke}
            strokeWidth={1}
            cornerRadius={object.type === "chair" ? 8 : object.type === "label" ? 2 : 0}
          />
        )}
        {object.type === "chair" && (
          <Line points={[6, 9, object.width - 6, 9]} stroke={colors.stroke} strokeWidth={4} />
        )}
        {object.type === "stand" && (
          <Line
            points={[object.width / 2, 8, object.width / 2, object.height - 8]}
            stroke={colors.stroke}
            strokeWidth={2}
          />
        )}
        <Text
          width={object.width}
          height={object.height}
          text={label || t(objectLabels[object.type])}
          align="center"
          verticalAlign="middle"
          fontSize={12}
          fill={colors.text}
          fontFamily="Montserrat Variable"
          padding={3}
        />
      </Group>
      {selected && editing && !busy && (
        <Transformer
          ref={transformer}
          flipEnabled={false}
          keepRatio={false}
          ignoreStroke
          enabledAnchors={
            Math.min(object.width, object.height) * canvasScale < 48
              ? ["top-left", "top-right", "bottom-left", "bottom-right"]
              : undefined
          }
          padding={4}
          anchorSize={16}
          rotateAnchorOffset={30}
          rotateAnchorAngle={object.y * canvasScale < 40 ? 180 : 0}
          borderStrokeWidth={1}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 10 * canvasScale ||
            newBox.height < 10 * canvasScale ||
            newBox.width > 500 * canvasScale ||
            newBox.height > 500 * canvasScale
              ? oldBox
              : newBox
          }
          borderStroke={colors.stroke}
          anchorStroke={colors.stroke}
        />
      )}
    </>
  );
}
function ObjectProperties({
  object,
  snapshot,
  busy,
  onEdit,
}: EditorProps & {
  object: StageObject;
}) {
  const { t } = useLanguage();
  const [changes, setChanges] = useState<{
    entity: StageObject;
    revision: number;
  } | null>(null);
  const draft = changes?.entity ?? object;
  const revision = changes?.revision ?? snapshot.concert.revision;
  const updateDraft = (next: StageObject) => {
    setChanges({ entity: next, revision });
  };
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onEdit({ type: "put", entity: draft }, revision)) setChanges(null);
      }}
    >
      <div className="field">
        <label htmlFor="object-label">{t("Label")}</label>
        <Input
          id="object-label"
          value={draft.label}
          maxLength={160}
          onChange={(event) => updateDraft({ ...draft, label: event.target.value })}
        />
      </div>
      <div className="flex items-center justify-between">
        <Button disabled={busy}>{t("Save object")}</Button>
        <DeleteButton
          label={object.label || t(objectLabels[object.type])}
          busy={busy}
          onDelete={() => onEdit({ type: "delete", id: object.id })}
        />
      </div>
      {changes && snapshot.concert.revision !== revision && (
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>{t("Shared changes arrived. Your draft is preserved; reload before saving.")}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setChanges(null)}>
            {t("Reload object")}
          </Button>
        </div>
      )}
    </form>
  );
}
