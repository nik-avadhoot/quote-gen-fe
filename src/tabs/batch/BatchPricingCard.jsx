import BatchPricingBasisWorkspace from "./BatchPricingBasisWorkspace.jsx";
import { useAppState } from "../../state/AppStateContext.js";
import { SummaryRow } from "../../ui/dataDisplay.jsx";

export default function BatchPricingCard(props) {
  const { durableBatch } = useAppState();
  const release = durableBatch?.pricing_basis_release;
  const facts = [
    durableBatch?.batch_reference || "No governed Batch",
    release?.name || release?.label || "Release unresolved",
    durableBatch?.plant?.plant_code || props.fallbackPlantCode || "Plant unresolved",
  ];
  return (
    <section className="batch-pricing-header-card" aria-labelledby="batch-pricing-card-title">
      <div id="batch-pricing-card-title" className="batch-pricing-card-rail">PRICING</div>
      <div className="batch-pricing-card-body">
        <SummaryRow title="Basis" facts={facts}
          status={durableBatch?.status || "Unbound"}
          statusTone={durableBatch?.status === "working" ? "positive" : "neutral"}
          style={{ border: 0, borderRadius: 0, background: "transparent" }}
          contentStyle={{ padding: 0 }}>
          <BatchPricingBasisWorkspace compact {...props} />
        </SummaryRow>
      </div>
    </section>
  );
}
