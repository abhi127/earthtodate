import VendorSearchForm from './VendorSearchForm';

// Both vendors currently share the generic AOI/date/cloud search form
// (collections are backend-owned config). If a vendor needs bespoke
// filters later, add a vendor-specific form here.
const VENDOR_COMPONENTS = {
  'mgp-pro': {
    displayName: 'MGP Pro',
    SearchForm: VendorSearchForm,
  },
  'blacksky': {
    displayName: 'BlackSky',
    SearchForm: VendorSearchForm,
  },
};

export function getVendorList() {
  return Object.entries(VENDOR_COMPONENTS).map(([id, v]) => ({ id, displayName: v.displayName }));
}

export function getVendorComponent(vendorId) {
  return VENDOR_COMPONENTS[vendorId] || null;
}

export default VENDOR_COMPONENTS;
