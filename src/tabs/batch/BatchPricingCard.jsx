import BatchPricingBasisWorkspace from "./BatchPricingBasisWorkspace.jsx";
import { useAppState } from "../../state/AppStateContext.js";
import { SummaryRow } from "../../ui/dataDisplay.jsx";
import { C } from "../../theme.js";

const pricingSectionLabel={color:C.amber,fontWeight:700,fontSize:7.5,
  textTransform:"uppercase",letterSpacing:"0.12em",whiteSpace:"nowrap"};

export default function BatchPricingCard(props) {
  const { durableBatch } = useAppState();
  const release = durableBatch?.pricing_basis_release;
  const facts = [
    durableBatch?.batch_reference || "No governed Batch",
    release?.name || release?.label || "Release unresolved",
    durableBatch?.plant?.plant_code || props.fallbackPlantCode || "Plant unresolved",
  ];
  return (
    <SummaryRow title="Pricing" facts={facts}
      status={durableBatch?.status || "Unbound"}
      statusTone={durableBatch?.status === "working" ? "positive" : "neutral"}
      verticalTitleWhenExpanded titleStyle={pricingSectionLabel}
      style={{height:"100%"}}
      contentStyle={{padding:0}}>
      <BatchPricingBasisWorkspace compact {...props} />
    </SummaryRow>
  );
}
