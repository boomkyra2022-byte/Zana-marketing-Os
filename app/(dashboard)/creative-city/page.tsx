import { CreativeCityClient } from '@/components/creative-city-client';

// ZANA Creative City — map of the 10-station Creative Factory pipeline
// (docs/creative-factory/CREATIVE_FACTORY_HANDOFF.md §8.1). Lives under
// (dashboard) so middleware.ts keeps it behind login + profile approval:
// the page shows margin and strategy data and must never be public.
// Station data is static for now (lib/creative-city/stations.ts); §8.2
// moves it to Supabase.
export const metadata = { title: 'ZANA Creative City · ZANA Marketing OS' };

export default function CreativeCityPage() {
  return <CreativeCityClient />;
}
