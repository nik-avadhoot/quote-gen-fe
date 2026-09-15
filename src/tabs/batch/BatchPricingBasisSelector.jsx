import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/apiClient.js";
import { classifyResponse } from "../../lib/backendError.js";
import {
  automaticPricingBasisSuggestion,
  isValidDateOnly,
  localIsoDate,
  pricingBasisOptions,
  PRICING_BASIS_ILLUSTRATION,
} from "../../lib/pricingBasisModel.js";
import {
  persistedSelectionState,
  pricingBasisDraftFromBatch,
  pricingBasisDraftIsDirty,
  setBatchPricingBasisBody,
} from "../../lib/batchPricingBasis.js";
import { LifecycleBadge, PermanentCode } from "../../ui/dataDisplay.jsx";
import { C, mono, sans } from "../../theme.js";

const defaultDraft = () => ({
  pricingDate: localIsoDate(),
  releaseId: null,
  selectionMode: null,
});

function StateMessage({ tone = "muted", children }) {
  const palette = tone === "error"
    ? { border: C.red, background: C.redL, color: C.red }
    : tone === "warning"
      ? { border: C.amber, background: C.amberL, color: C.amberD }
      : { border: C.border, background: C.paper, color: C.slateL };
  return <div role="status" style={{ border: `1px solid ${palette.border}`,
    background: palette.background, color: palette.color, borderRadius: 5,
    padding: "6px 8px", fontSize: 9.5, lineHeight: 1.4 }}>{children}</div>;
}

export default function BatchPricingBasisSelector({
  plantCode,
  draft: controlledDraft,
  setDraft: controlledSetDraft,
  fixtureOnly = false,
  persistedBatch = null,
  onPersist,
  saving = false,
  compact = false,
  batchOpenControls = null,
  batchReferenceField = null,
  batchMeta = null,
  batchStatusNote = null,
}) {
  const durable = persistedBatch != null;
  const [internalDraft, setInternalDraft] = useState(() => pricingBasisDraftFromBatch(persistedBatch) || ({
      ...defaultDraft(),
      pricingDate: fixtureOnly ? "2026-09-11" : localIsoDate(),
    }));
  const draft = controlledDraft || internalDraft;
  const setDraft = controlledSetDraft || setInternalDraft;
  const [read, setRead] = useState(() => fixtureOnly
    ? { status: "ready", releases: PRICING_BASIS_ILLUSTRATION, partial: false }
    : { status: "loading", releases: [], partial: false });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!persistedBatch) return;
    setDraft(pricingBasisDraftFromBatch(persistedBatch));
  }, [persistedBatch, setDraft]);

  useEffect(() => {
    if (fixtureOnly) return;
    let cancelled = false;
    (async () => {
      setRead(current => ({ ...current, status: "loading" }));
      let response;
      let data;
      try {
        response = await apiFetch("/masters/pricing-basis-releases");
        data = await response.json().catch(() => ({}));
      } catch {
        if (!cancelled) setRead({ status: "error", releases: [], partial: false,
          message: "The governed catalogue could not be reached. No local release was substituted." });
        return;
      }
      if (cancelled) return;
      const verdict = classifyResponse({ ok: response.ok, status: response.status, data });
      if (verdict.kind === "ok") {
        setRead({ status: "ready", releases: Array.isArray(data.releases) ? data.releases : [],
          partial: data.components_partial === true });
      } else if (verdict.kind === "access-denied") {
        setRead({ status: "denied", releases: [], partial: false, message: verdict.message });
      } else {
        setRead({ status: "error", releases: [], partial: false, message: verdict.message });
      }
    })();
    return () => { cancelled = true; };
  }, [fixtureOnly, reloadKey]);

  const options = useMemo(() => pricingBasisOptions(
    read.releases,
    plantCode,
    draft.pricingDate,
  ), [read.releases, plantCode, draft.pricingDate]);
  const eligible = options.filter(option => option.eligibility.eligible);
  const unavailable = options.filter(option => !option.eligibility.eligible);

  useEffect(() => {
    if (read.status !== "ready") return;
    setDraft(current => {
      const currentOptions = pricingBasisOptions(read.releases, plantCode, current.pricingDate);
      if (current.releaseId != null) return current;
      // U4: a persisted choice is evidence, even when it later becomes
      // ineligible. Only a genuinely unresolved Batch receives a suggestion.
      if (durable && persistedBatch.pricing_basis_release_id != null) return current;
      const suggestion = automaticPricingBasisSuggestion(currentOptions);
      const next = {
        ...current,
        releaseId: suggestion?.id ?? null,
        selectionMode: suggestion ? "automatic_default" : null,
      };
      return String(next.releaseId) === String(current.releaseId)
        && next.selectionMode === current.selectionMode ? current : next;
    });
  }, [draft.pricingDate, durable, persistedBatch, plantCode, read.releases, read.status, setDraft]);

  const selectedOption = options.find(option => String(option.release.id) === String(draft.releaseId));
  const selected = selectedOption?.release || null;
  const durableState = durable ? persistedSelectionState(persistedBatch, read.releases, draft) : null;
  const dirty = durable && pricingBasisDraftIsDirty(persistedBatch, draft);
  const canPersist = dirty && isValidDateOnly(draft.pricingDate)
    && (draft.selectionMode === "automatic_default" || durableState?.eligible === true);
  const automatic = automaticPricingBasisSuggestion(options);
  const choose = event => {
    const id = event.target.value;
    const release = eligible.find(option => String(option.release.id) === id)?.release;
    setDraft(current => ({ ...current, releaseId: release?.id ?? null,
      selectionMode: release ? (durable ? "deliberate"
        : release.is_automatic_default ? "automatic_default" : "explicit_alternative") : null }));
  };

  const persist = () => {
    if (!canPersist || !onPersist) return;
    onPersist({ draft, body: setBatchPricingBasisBody(persistedBatch, draft) });
  };

  if (compact) {
    const notice = !plantCode
      ? "Select a Producing Plant to see Releases."
      : !isValidDateOnly(draft.pricingDate)
        ? "Enter a valid calendar date."
        : read.status === "loading"
          ? "Loading governed Releases…"
          : read.status === "denied"
            ? "Release details denied; no hidden Release is inferred."
            : read.status === "error"
              ? (read.message || "The governed catalogue could not be reached.")
              : durableState?.warning
                ? durableState.warning
                : options.length === 0
                  ? `No caller-visible Releases for ${plantCode}.`
                  : eligible.length === 0
                    ? "No approved Release covers this date; the Batch remains unresolved."
                    : read.partial
                      ? "Some component details are unavailable; no value is guessed."
                      : durable
                        ? "Persisted governed selection · Calculate and Atomic Send run from the Batch workspace."
                        : "Session selection only · open a governed Batch to Calculate or Send.";
    const warning = read.status === "error" || read.status === "denied"
      || !!durableState?.warning || (read.status === "ready" && eligible.length === 0);
    // Presentation only: one inline note beside the Release row. A pending or
    // failed Batch open is shown first; the full text of both stays in title.
    const batchNoteFirst = batchStatusNote?.priority && batchStatusNote.text;
    const noteText = batchNoteFirst ? batchStatusNote.text : notice;
    const noteWarning = warning || !!batchStatusNote?.warning;
    const noteTitle = [batchStatusNote?.text, notice].filter(Boolean).join(" · ");
    return (
      <div className="batch-pb-selector-compact" aria-label="Working Batch Pricing Basis">
        <div className="batch-pb-compact-controls">
          <div className="batch-pb-compact-row batch-pb-date-row">
            {batchReferenceField}
            <strong className="batch-pb-compact-label">DATE</strong>
            <label className="batch-pb-date-field" title="Pricing date">
              <span className="batch-pb-sr-label">Pricing date</span>
              <input type="date" aria-label="Pricing date" value={draft.pricingDate || ""}
                onChange={event => setDraft(current => ({ ...current, pricingDate: event.target.value }))} />
            </label>
            {batchOpenControls}
          </div>
          {batchMeta}
          <div className="batch-pb-compact-row batch-pb-release-row">
            <strong className="batch-pb-compact-label">RELEASE</strong>
            <label className="batch-pb-release-field" title="Governed Pricing Basis Release">
              <span className="batch-pb-sr-label">Governed Release</span>
              <select aria-label="Governed Release" value={selected ? String(selected.id) : ""} onChange={choose}
                disabled={!plantCode || read.status !== "ready" || !isValidDateOnly(draft.pricingDate)}>
                <option value="">{eligible.length ? "Choose eligible Release" : "No eligible Release"}</option>
                {selected && !selectedOption?.eligibility.eligible && (
                  <option value={String(selected.id)} disabled>
                    Persisted unavailable · {selected.release_name || "Unnamed"} · #{selected.id}
                  </option>
                )}
                {eligible.map(option => <option value={String(option.release.id)} key={option.release.id}>
                  {option.release.release_name || "Unnamed"} · #{option.release.id}
                  {option.release.is_automatic_default ? " · default" : " · alternative"}
                </option>)}
              </select>
            </label>
            <span className={`batch-pb-mode ${draft.selectionMode === "deliberate" ? "is-deliberate" : ""}`}
              title={selected ? `${selected.release_name || "Unnamed Release"} · ${selected.effective_from || "—"} to ${selected.effective_until || "open-ended"}` : "No persisted Release"}>
              {selected ? `#${selected.id} · ${draft.selectionMode === "deliberate" ? "deliberate" : "default"}` : "unresolved"}
            </span>
            <span role="status" className={`batch-pb-compact-notice ${noteWarning ? "is-warning" : ""}`}
              title={noteTitle}>
              {(fixtureOnly || batchStatusNote?.fixtureLabel) && <strong>
                {fixtureOnly ? "FIXTURE ONLY" : batchStatusNote.fixtureLabel} ·
              </strong>}
              <span>{noteText}</span>
              {read.status === "error" && <button type="button" onClick={() => setReloadKey(key => key + 1)}>Retry</button>}
            </span>
            {durable && <div className="batch-pb-governed-actions">
              <button type="button" className="batch-pb-icon-action"
                onClick={() => setDraft(current => ({ ...current,
                  releaseId: automatic?.id ?? null, selectionMode: "automatic_default" }))}
                disabled={read.status !== "ready"} title="Use the automatic default">AUTO</button>
              <button type="button" className="batch-pb-save" onClick={persist}
                disabled={!canPersist || saving}
                title={!dirty ? "No Pricing Basis change to save"
                  : !canPersist ? "Choose an eligible Release, or use the automatic default"
                    : "Persist through the governed Batch operation"}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Working Batch Pricing Basis" style={{ flexShrink: 0, fontFamily: sans,
      borderBottom: `1px solid ${C.border}`, background: C.white, padding: "8px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <div style={{ minWidth: 185 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: C.slate }}>Pricing Basis for this working Batch</div>
          <div style={{ fontSize: 8.8, color: C.slateL, marginTop: 1 }}>
            {durable ? `Persisted on ${persistedBatch.batch_reference} · content v${persistedBatch.content_version}`
              : "Session-only U3 selection · open a governed Batch for durable U4 linkage"}
          </div>
        </div>

        <label style={{ fontSize: 8.8, color: C.slateL, fontWeight: 750 }}>
          Pricing date
          <input type="date" value={draft.pricingDate || ""}
            onChange={event => setDraft(current => ({ ...current,
              pricingDate: event.target.value }))}
            style={{ display: "block", marginTop: 2, padding: "3px 5px", fontSize: 10,
              border: `1px solid ${C.border}`, borderRadius: 4, background: C.white }} />
        </label>

        <label style={{ flex: 1, minWidth: 260, fontSize: 8.8, color: C.slateL, fontWeight: 750 }}>
          Governed Release
          <select value={selected ? String(selected.id) : ""} onChange={choose}
            disabled={!plantCode || read.status !== "ready" || !isValidDateOnly(draft.pricingDate)}
            style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 6px",
              border: `1px solid ${C.border}`, borderRadius: 4, background: C.white,
              color: C.slate, fontSize: 10.5 }}>
            <option value="">{eligible.length ? "Choose an eligible Release" : "No eligible Release"}</option>
            {selected && !selectedOption?.eligibility.eligible && (
              <option value={String(selected.id)} disabled>
                Persisted · unavailable · {selected.release_name || "Unnamed Release"} · #{selected.id}
              </option>
            )}
            {eligible.map(option => <option value={String(option.release.id)} key={option.release.id}>
              {option.release.release_name || "Unnamed Release"} · #{option.release.id}
              {option.release.is_automatic_default ? " · automatic default" : " · approved alternative"}
            </option>)}
          </select>
        </label>

        {selected && <div style={{ minWidth: 235, maxWidth: 340, padding: "5px 7px",
          border: `1px solid ${C.green}`, background: C.greenL, borderRadius: 5,
          fontSize: 9.3, color: C.slateM, lineHeight: 1.4 }}>
          <strong>{draft.selectionMode === "deliberate" || draft.selectionMode === "explicit_alternative"
            ? "Deliberate selection" : "Automatic default"}</strong>
          {" · "}<PermanentCode code={`${selected.plant?.plant_code || plantCode} · Release #${selected.id}`} />
          <div>{selected.release_name || "Unnamed Release"} · effective {selected.effective_from}
            {selected.effective_until ? ` to ${selected.effective_until}` : " onward"}</div>
        </div>}
      </div>

      <div style={{ marginTop: 6 }}>
        {!plantCode && <StateMessage>Select a Producing Plant above to see caller-visible Releases.</StateMessage>}
        {plantCode && !isValidDateOnly(draft.pricingDate) &&
          <StateMessage tone="warning">Enter a valid calendar date. Date-only semantics are preserved.</StateMessage>}
        {plantCode && read.status === "loading" && <StateMessage>Loading governed Releases…</StateMessage>}
        {plantCode && read.status === "denied" && <StateMessage tone="warning">
          Pricing Basis details are denied for this caller. No hidden Release is inferred.
        </StateMessage>}
        {plantCode && read.status === "error" && <StateMessage tone="error">
          {read.message || "The governed Pricing Basis read failed."}{" "}
          <button type="button" onClick={() => setReloadKey(key => key + 1)}
            style={{ border: 0, padding: 0, background: "transparent", color: C.red,
              textDecoration: "underline", cursor: "pointer", fontWeight: 800 }}>Retry</button>
        </StateMessage>}
        {plantCode && read.status === "ready" && options.length === 0 &&
          <StateMessage>No caller-visible Releases exist for {plantCode} on this view.</StateMessage>}
        {plantCode && read.status === "ready" && options.length > 0 && eligible.length === 0 &&
          <StateMessage tone="warning">No approved Release covers this plant and date. The working Batch remains unresolved.</StateMessage>}
        {read.partial && <StateMessage tone="warning">
          Some component details are unavailable to this caller; Release identity and eligibility are not guessed.
        </StateMessage>}
        {durable && durableState?.warning && <StateMessage tone="warning">
          {durableState.warning}
        </StateMessage>}
      </div>

      {unavailable.length > 0 && <details style={{ marginTop: 5, fontSize: 9.2, color: C.slateM }}>
        <summary style={{ cursor: "pointer", color: C.slateL, fontWeight: 750 }}>
          {unavailable.length} unavailable Release{unavailable.length === 1 ? "" : "s"} for this date
        </summary>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
          {unavailable.map(option => <div key={option.release.id} style={{ padding: "4px 6px",
            border: `1px solid ${C.border}`, borderRadius: 4, background: C.paper }}>
            <span style={{ fontFamily: mono }}>#{option.release.id}</span>{" · "}
            {option.release.release_name || "Unnamed Release"}{" · "}
            <LifecycleBadge status={option.release.status} />{" · "}{option.eligibility.reason}
          </div>)}
        </div>
      </details>}

      {durable && <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7,
        flexWrap: "wrap" }}>
        <button type="button" onClick={() => setDraft(current => ({ ...current,
            releaseId: automatic?.id ?? null, selectionMode: "automatic_default" }))}
          disabled={read.status !== "ready"}
          style={{ border: `1px solid ${C.border}`, background: C.white, color: C.slate,
            borderRadius: 4, padding: "5px 8px", fontSize: 9.5, fontWeight: 750,
            cursor: read.status === "ready" ? "pointer" : "default" }}>
          Use automatic default{automatic ? ` · #${automatic.id}` : " · unresolved"}
        </button>
        <button type="button" onClick={persist} disabled={!canPersist || saving}
          title={!dirty ? "No Pricing Basis change to save"
            : !canPersist ? "Choose an eligible Release, or explicitly use the automatic default"
              : "Persist through the governed Batch operation"}
          style={{ border: 0, background: canPersist ? C.amber : C.border, color: C.white,
            borderRadius: 4, padding: "6px 10px", fontSize: 9.5, fontWeight: 800,
            cursor: canPersist && !saving ? "pointer" : "default" }}>
          {saving ? "Saving…" : "Save Pricing Basis"}
        </button>
        <span style={{ color: C.slateL, fontSize: 8.8 }}>
          {dirty ? "Unsaved Batch change" : "Matches persisted Batch"}
        </span>
      </div>}

      <div style={{ marginTop: 5, fontSize: 8.8, color: C.amberD, fontWeight: 700 }}>
          {durable
          ? fixtureOnly
            ? "Fixture only: save/reopen stays in isolated memory. Governed Calculate and Send remain unavailable."
            : "Pricing Basis saves through the governed Batch RPC. Calculate and Atomic Send are available in the Batch workspace."
          : "This choice is not saved and does not enable governed Calculate or Send until a Batch is opened."}
        {fixtureOnly ? " Illustrative fixture only; never mixed with authoritative data." : ""}
      </div>
    </section>
  );
}
