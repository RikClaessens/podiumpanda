import { lazy, Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "../lib/language";
import { ofKind, applyCommand, commandSchema, type Edit, type Snapshot } from "../../shared/model";
import { AppPage } from "./app-page";
import { Button } from "./ui/button";
import { Picker } from "./picker";
import { PandaLoading } from "./panda-loading";
import { recentGroups } from "../lib/local";
import { editConcert, getConcert, getGroup } from "../lib/api";
import {
  createStandaloneFloorplanSnapshot,
  floorplanEditsForConcert,
  floorplanEditsForStandalone,
  parseLocalFloorplanState,
  STANDALONE_FLOORPLAN_STORAGE_KEY,
} from "../lib/standalone-floorplan";

const Floorplans = lazy(() => import("./floorplans"));

export function StagePlanner() {
  const { t, dynamic } = useLanguage();
  const queryClient = useQueryClient();
  const [initial] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STANDALONE_FLOORPLAN_STORAGE_KEY);
      return {
        snapshot: saved
          ? parseLocalFloorplanState(JSON.parse(saved)).snapshot
          : createStandaloneFloorplanSnapshot(),
        savedDraft: Boolean(saved),
        error: "",
      };
    } catch (error) {
      console.warn("Could not read the standalone floorplan draft.", error);
      return {
        snapshot: createStandaloneFloorplanSnapshot(),
        savedDraft: false,
        error: error instanceof Error ? error.message : "Could not read the saved floorplan draft.",
      };
    }
  });
  const [snapshot, setSnapshot] = useState<Snapshot>(initial.snapshot);
  const [savedDraft, setSavedDraft] = useState(initial.savedDraft);
  const [error, setError] = useState(initial.error);
  const [selectedFloorplan, setSelectedFloorplan] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedConcert, setSelectedConcert] = useState("");
  const [selectedSourceFloorplan, setSelectedSourceFloorplan] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [loadMessage, setLoadMessage] = useState("");
  const [savedGroupData] = useState(() => {
    try {
      return { groups: recentGroups(), error: "" };
    } catch (readError) {
      console.warn("Could not read locally saved groups.", readError);
      return {
        groups: [],
        error:
          readError instanceof Error ? readError.message : "Could not read locally saved groups.",
      };
    }
  });
  const groups = savedGroupData.groups;
  const selectedShortcut = groups.find((group) => group.id === selectedGroup);
  const groupQuery = useQuery({
    queryKey: ["stage-planner-group", selectedShortcut?.id, selectedShortcut?.key],
    queryFn: () => getGroup(selectedShortcut!.id, selectedShortcut!.key),
    enabled: Boolean(selectedShortcut),
    staleTime: 30000,
    retry: 1,
  });
  const groupData = groupQuery.data;
  const concertKey = ["stage-planner-concert", selectedConcert, selectedShortcut?.key] as const;
  const concertQuery = useQuery({
    queryKey: concertKey,
    queryFn: () => getConcert(selectedConcert, selectedShortcut!.key),
    enabled: Boolean(selectedConcert && selectedShortcut),
    retry: 1,
  });
  const sourcePlans = concertQuery.data ? ofKind(concertQuery.data, "floorplan") : [];
  const sourceFloorplanId = sourcePlans.some((plan) => plan.id === selectedSourceFloorplan)
    ? selectedSourceFloorplan
    : sourcePlans[0]?.id;
  const planId =
    selectedFloorplan && ofKind(snapshot, "floorplan").some((plan) => plan.id === selectedFloorplan)
      ? selectedFloorplan
      : ofKind(snapshot, "floorplan")[0]?.id;

  function persistLocalEdits(edits: Edit[]) {
    if (saving) return false;
    setError("");
    try {
      let next = snapshot;
      for (const edit of edits) {
        const command = commandSchema.parse({
          ...edit,
          expectedRevision: next.concert.revision,
        });
        next = applyCommand(next, command);
      }
      window.localStorage.setItem(
        STANDALONE_FLOORPLAN_STORAGE_KEY,
        JSON.stringify({ snapshot: next }),
      );
      setSnapshot(next);
      setSavedDraft(true);
      return true;
    } catch (editError) {
      console.warn("Could not save the standalone floorplan draft.", editError);
      setError(
        editError instanceof Error
          ? editError.message
          : "Could not save the standalone floorplan draft.",
      );
      return false;
    }
  }

  async function onLocalEdit(edit: Edit) {
    return persistLocalEdits([edit]);
  }

  function loadFromConcert() {
    const source = concertQuery.data;
    if (!source || !sourceFloorplanId || saving) return;
    setLoadMessage("");
    try {
      const imported = floorplanEditsForStandalone(source, sourceFloorplanId);
      if (persistLocalEdits(imported.edits)) {
        setSelectedFloorplan(imported.floorplanId);
        setLoadMessage(t("Floorplan loaded from {concert}.", { concert: source.concert.title }));
      }
    } catch (loadError) {
      console.error("Could not load a concert floorplan into the standalone planner.", loadError);
      setError(
        loadError instanceof Error
          ? dynamic(loadError.message)
          : t("Could not load the floorplan."),
      );
    }
  }

  async function saveToConcert() {
    const destination = concertQuery.data;
    if (!destination || !selectedShortcut || !planId || saving) return;
    setSaving(true);
    setSaveMessage("");
    let updated = destination;
    let copied = 0;
    try {
      const edits = floorplanEditsForConcert(snapshot, planId, destination);
      for (const edit of edits) {
        updated = await editConcert(selectedConcert, selectedShortcut.key, updated, edit);
        copied++;
        queryClient.setQueryData(concertKey, updated);
      }
      setSaveMessage(t("Floorplan saved to {concert}.", { concert: destination.concert.title }));
    } catch (saveError) {
      console.error("Could not copy the standalone floorplan to the concert.", saveError);
      const reason =
        saveError instanceof Error ? dynamic(saveError.message) : t("The save failed.");
      setSaveMessage(
        copied
          ? t("The floorplan was partly saved ({count} of {total}). {reason}", {
              count: copied,
              total:
                copied +
                ofKind(snapshot, "object").filter((item) => item.floorplanId === planId).length,
              reason,
            })
          : t("Could not save the floorplan. {reason}", { reason }),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPage app="/apps/stage-planner">
      <div className="space-y-4">
        {(error || savedGroupData.error) && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {dynamic(error || savedGroupData.error)}
          </p>
        )}
        {groupQuery.error && selectedShortcut && (
          <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {t("Could not load group {group}: {reason}", {
              group: selectedShortcut.title,
              reason: dynamic(groupQuery.error.message),
            })}
          </div>
        )}
        <Suspense fallback={<PandaLoading label={t("Loading floorplan editor…")} />}>
          <Floorplans
            snapshot={snapshot}
            busy={saving}
            onEdit={onLocalEdit}
            onPlanChange={setSelectedFloorplan}
            selectedPlanId={selectedFloorplan}
          />
        </Suspense>
        <section className="panel space-y-4">
          <div>
            <h2 className="section-title">{t("Concert floorplans")}</h2>
            <p className="text-sm text-muted-foreground">
              {savedDraft
                ? t("Your standalone floorplans are saved on this device.")
                : t("Your standalone floorplans are saved on this device as you edit.")}
            </p>
          </div>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("Open a group on this device to save a floorplan to one of its concerts.")}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="stage-planner-group">{t("Group")}</label>
                <Picker
                  id="stage-planner-group"
                  value={selectedGroup}
                  className="w-full"
                  options={[
                    { value: "", label: t("Choose a group") },
                    ...groups.map((group) => ({ value: group.id, label: group.title })),
                  ]}
                  onValueChange={(value) => {
                    setSelectedGroup(value);
                    setSelectedConcert("");
                    setSelectedSourceFloorplan("");
                    setSaveMessage("");
                    setLoadMessage("");
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="stage-planner-concert">{t("Concert")}</label>
                <Picker
                  id="stage-planner-concert"
                  value={selectedConcert}
                  className="w-full"
                  disabled={!groupData || groupData.concerts.length === 0}
                  options={[
                    { value: "", label: t("Choose a concert") },
                    ...(groupData?.concerts.map((concert) => ({
                      value: concert.id,
                      label: concert.title,
                    })) ?? []),
                  ]}
                  onValueChange={(value) => {
                    setSelectedConcert(value);
                    setSelectedSourceFloorplan("");
                    setSaveMessage("");
                    setLoadMessage("");
                  }}
                />
              </div>
            </div>
          )}
          {selectedGroup && groupQuery.isPending && (
            <p className="text-sm text-muted-foreground">{t("Loading your group…")}</p>
          )}
          {selectedGroup && groupData?.concerts.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("This group has no concerts yet.")}</p>
          )}
          {selectedConcert && concertQuery.error && (
            <p role="alert" className="text-sm text-destructive">
              {dynamic(concertQuery.error.message)}
            </p>
          )}
          {selectedConcert && concertQuery.isPending && (
            <p className="text-sm text-muted-foreground">{t("Loading your concert…")}</p>
          )}
          {concertQuery.data && (
            <div className="grid gap-5 border-t border-border pt-4 sm:grid-cols-2">
              <div className="space-y-3">
                <h3 className="font-semibold">{t("Load from concert")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("Loading adds a copy to your draft without replacing existing floorplans.")}
                </p>
                {sourcePlans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("This concert has no floorplans yet.")}
                  </p>
                ) : (
                  <div className="field">
                    <label htmlFor="stage-planner-source-floorplan">{t("Floorplan to load")}</label>
                    <Picker
                      id="stage-planner-source-floorplan"
                      value={sourceFloorplanId ?? ""}
                      className="w-full"
                      options={sourcePlans.map((plan) => ({
                        value: plan.id,
                        label: plan.name,
                      }))}
                      onValueChange={(value) => {
                        setSelectedSourceFloorplan(value);
                        setLoadMessage("");
                      }}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!sourceFloorplanId || saving}
                    onClick={loadFromConcert}
                  >
                    {t("Load floorplan")}
                  </Button>
                  {loadMessage && (
                    <output className="text-sm text-muted-foreground">{loadMessage}</output>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold">{t("Save to concert")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("Copy the selected draft floorplan and its objects to this concert.")}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    disabled={!planId || saving}
                    onClick={() => void saveToConcert()}
                  >
                    {t("Save floorplan to concert")}
                  </Button>
                  {saveMessage && (
                    <output className="text-sm text-muted-foreground">{saveMessage}</output>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppPage>
  );
}
