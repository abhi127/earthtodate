import MgpProSearchForm from './mgp-pro/MgpProSearchForm';

const VENDOR_COMPONENTS = {
  'mgp-pro': {
    displayName: 'MGP Pro (Maxar)',
    SearchForm: MgpProSearchForm,
  },
};

export function getVendorList() {
  return Object.entries(VENDOR_COMPONENTS).map(([id, v]) => ({ id, displayName: v.displayName }));
}

export function getVendorComponent(vendorId) {
  return VENDOR_COMPONENTS[vendorId] || null;
}

export default VENDOR_COMPONENTS;
