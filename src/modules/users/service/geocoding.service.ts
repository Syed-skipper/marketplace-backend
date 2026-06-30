export type GeocodedAddress = {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  state_district?: string;
  country?: string;
  postcode?: string;
};

type NominatimResponse = {
  display_name?: string;
  address?: NominatimAddress;
};

function buildStreet(address: NominatimAddress, displayName?: string): string {
  const parts = [address.house_number, address.road].filter(Boolean);
  if (parts.length) return parts.join(' ');

  const fallback = [address.neighbourhood, address.suburb].filter(Boolean).join(', ');
  if (fallback) return fallback;

  return displayName?.split(',')[0]?.trim() ?? '';
}

function pickCity(address: NominatimAddress): string {
  return (
    address.city ??
    address.town ??
    address.village ??
    address.suburb ??
    address.county ??
    address.state_district ??
    ''
  );
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<GeocodedAddress> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'MultiVendorMarketplace/1.0 (address lookup)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Reverse geocoding service unavailable');
  }

  const data = (await response.json()) as NominatimResponse;
  const address = data.address;

  if (!address) {
    throw new Error('Could not resolve an address for this location');
  }

  const street = buildStreet(address, data.display_name);
  const city = pickCity(address);
  const state = address.state ?? address.state_district ?? '';
  const country = address.country ?? '';
  const postalCode = address.postcode ?? '';

  if (!street && !city) {
    throw new Error('Could not resolve an address for this location');
  }

  return {
    street: street || city,
    city: city || state || country,
    state: state || city,
    country: country || 'India',
    postalCode,
  };
}
