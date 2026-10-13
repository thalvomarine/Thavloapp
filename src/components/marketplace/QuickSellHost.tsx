import { useEffect, useState } from "react";
import { CreateBoatListingSheet } from "@/components/marketplace/CreateBoatListingSheet";
import { loadSharedBoatListings, saveBoatListing, type BoatListing } from "@/lib/boat-listings";
import { THALVO_QUICK_SELL_EVENT } from "@/lib/quick-sell-bus";
import type { Profile } from "@/lib/session";

/**
 * Global host for the Hızlı Sat / ilan form so THALVO AI can open it from
 * any authenticated cockpit screen.
 */
export function QuickSellHost({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [listingCount, setListingCount] = useState(0);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(THALVO_QUICK_SELL_EVENT, onOpen);
    return () => window.removeEventListener(THALVO_QUICK_SELL_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadSharedBoatListings(profile.id)
      .then((rows) => setListingCount(rows.filter((row) => row.ownerId === profile.id).length))
      .catch(() => setListingCount(0));
  }, [open, profile.id]);

  const sellerName =
    profile.boat_name?.trim() ||
    profile.full_name?.trim() ||
    profile.business_name?.trim() ||
    "Captain";

  return (
    <CreateBoatListingSheet
      open={open}
      onClose={() => setOpen(false)}
      sellerName={sellerName}
      listingCount={listingCount}
      ownerId={profile.id}
      intent="quick_sell"
      onSaved={async (listing: BoatListing) => {
        await saveBoatListing(listing, profile.id);
        setOpen(false);
      }}
    />
  );
}
