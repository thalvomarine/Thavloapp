import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Store, User, UserCircle2 } from "lucide-react";
import { RescueMark, ControlTowerMark } from "@/components/brand/ProductMarks";
import type { Profile } from "@/lib/session";
import { setMapChromeOverlay } from "@/lib/map-chrome";

interface Props {
  profile: Profile;
  isAdmin: boolean;
  /** Smaller trigger button for tight floating chrome (map cockpit top bar). */
  compact?: boolean;
}

/**
 * Account dropdown — Profile / role shortcuts / Admin / Sign out. Shared by
 * `MissionShell`'s header and the fullscreen map cockpit's floating brand chip.
 */
export function AccountMenuButton({ profile, isAdmin, compact = false }: Props) {
  const navigate = useNavigate();
  const isSupplier = profile.role === "Supplier";
  const isProvider = profile.role === "Provider";

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <DropdownMenu onOpenChange={(open) => setMapChromeOverlay("menu", open)}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account"
          className={
            "grid place-items-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors " +
            (compact ? "size-7" : "size-9")
          }
        >
          <UserCircle2 className={compact ? "size-3.5" : "size-4"} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="z-[70] w-56"
      >
        <DropdownMenuLabel className="truncate">{profile.full_name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/profile">
            <User className="size-4 mr-2" /> Profile
          </Link>
        </DropdownMenuItem>
        {isProvider && (
          <DropdownMenuItem asChild>
            <Link to="/app">
              <span className="mr-2 inline-grid place-items-center size-4">
                <RescueMark size={16} />
              </span>
              Missions
            </Link>
          </DropdownMenuItem>
        )}
        {isSupplier && (
          <DropdownMenuItem asChild>
            <Link to="/app/dealer">
              <Store className="size-4 mr-2" /> Inventory
            </Link>
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/app/admin">
              <span className="mr-2 inline-grid place-items-center size-4">
                <ControlTowerMark size={16} />
              </span>
              Control Tower
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="size-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
