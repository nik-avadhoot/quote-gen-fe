import { FOCUS } from "../../lib/quoteJourney.js";
import { useAppState } from "../../state/AppStateContext.js";
import "./BatchFirstShell.css";

export default function BatchFirstShell() {
  const {
    batchRows, chooseCustomerQuote, durableBatch, laneSelection, setTab,
  } = useAppState();
  const startCustomerQuote = () => {
    chooseCustomerQuote({
      promote: laneSelection?.lane !== "customer" && batchRows.length > 0,
    });
  };
  if (durableBatch?.id) return null;

  return <section className="batch-first-shell" aria-label="No active Batch">
    <span className="batch-first-shell__label">No governed Batch is active</span>
    <button type="button" id={FOCUS.newQuote} className="batch-first-shell__primary"
      onClick={startCustomerQuote}>
      New customer quote
    </button>
    <button type="button" className="batch-first-shell__secondary" onClick={() => setTab("mybatches")}>
      Open active Batch
    </button>
  </section>;
}
