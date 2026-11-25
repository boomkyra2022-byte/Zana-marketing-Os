import { accountDisplayName } from '@/lib/meta/ads-board-shared';
import type { BoardAccount } from '@/components/ads-board';

// ad_accounts rows -> account picker options: Meta's current name first, our
// own label alongside when it differs, enabled accounts on top.
export function toBoardAccounts(rows: { meta_account_id: string; name: string; meta_name: string | null; status: string }[]): BoardAccount[] {
  return rows
    .filter((a) => a.status !== 'disabled')
    .map((a) => {
      const name = accountDisplayName(a);
      return { metaAccountId: String(a.meta_account_id), name, label: name === a.name ? null : a.name, enabled: a.status === 'active' };
    })
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name, 'th'));
}
