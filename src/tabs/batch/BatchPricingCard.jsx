import BatchPricingBasisWorkspace from "./BatchPricingBasisWorkspace.jsx";

export default function BatchPricingCard(props) {
  return (
    <section className="batch-pricing-header-card" aria-labelledby="batch-pricing-card-title">
      <div id="batch-pricing-card-title" className="batch-pricing-card-rail">PRICING</div>
      <div className="batch-pricing-card-body">
        <BatchPricingBasisWorkspace compact {...props} />
      </div>
    </section>
  );
}
