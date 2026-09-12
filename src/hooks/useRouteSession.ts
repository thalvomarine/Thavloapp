/**
 * Editable coastal route session for LiveMap / Route Deck.
 * Recomputes only on commit (start, dragend, insert/remove via) — never mid-drag.
 */

import { useCallback, useRef, useState } from "react";
import {
  computeSeaRouteViaAsync,
  etaMinutesForNm,
  ROUTE_SPEED_OPTIONS_KTS,
  type SeaRouteLeg,
  type SeaRouteResult,
} from "@/lib/sea-route";
import { isFiniteLatLng, type LatLng } from "@/lib/sea-route/geometry";

export type RouteSessionMode = "idle" | "editing" | "active";

export type RouteSessionState = {
  mode: RouteSessionMode;
  origin: LatLng | null;
  destination: LatLng | null;
  vias: LatLng[];
  waypoints: LatLng[];
  legs: SeaRouteLeg[];
  distanceNm: number;
  etaMinutes: number | null;
  speedKts: number;
  optimizing: boolean;
};

const IDLE: RouteSessionState = {
  mode: "idle",
  origin: null,
  destination: null,
  vias: [],
  waypoints: [],
  legs: [],
  distanceNm: 0,
  etaMinutes: null,
  speedKts: ROUTE_SPEED_OPTIONS_KTS[1], // 8 kts default for deck dial
  optimizing: false,
};

function applyRoute(
  prev: RouteSessionState,
  route: SeaRouteResult,
  mode: RouteSessionMode,
): RouteSessionState {
  const waypoints = (route.waypoints ?? []).filter(isFiniteLatLng);
  if (waypoints.length < 2) return { ...prev, optimizing: false };
  return {
    ...prev,
    mode,
    waypoints,
    legs: route.legs ?? [],
    distanceNm: Number.isFinite(route.distanceNm) ? route.distanceNm : prev.distanceNm,
    etaMinutes: route.etaMinutes,
    speedKts: route.speedKts || prev.speedKts,
    optimizing: false,
  };
}

export function useRouteSession() {
  const [state, setState] = useState<RouteSessionState>(IDLE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const genRef = useRef(0);

  const recompute = useCallback(
    async (
      origin: LatLng,
      destination: LatLng,
      vias: LatLng[],
      speedKts: number,
      mode: RouteSessionMode,
    ) => {
      if (!isFiniteLatLng(origin) || !isFiniteLatLng(destination)) {
        console.error("[SeaRoute Error]: invalid session endpoints", { origin, destination });
        return;
      }
      const gen = ++genRef.current;
      setState((s) => {
        const keepPath = s.waypoints.length >= 2;
        return {
          ...s,
          optimizing: true,
          origin,
          destination,
          vias,
          speedKts,
          mode,
          // Never replace a real sea path with a straight land-cutting preview.
          waypoints: keepPath ? s.waypoints : [],
          legs: keepPath ? s.legs : [],
          distanceNm: keepPath ? s.distanceNm : Number.NaN,
          etaMinutes: keepPath ? s.etaMinutes : null,
        };
      });

      try {
        const route = await computeSeaRouteViaAsync(origin, destination, vias, speedKts);
        if (gen !== genRef.current) return;
        console.log("[RouteSession Waypoints]:", {
          count: route.waypoints?.length ?? 0,
          distanceNm: route.distanceNm,
          mode: route.mode,
        });
        setState((s) => applyRoute(s, route, mode));
      } catch (err) {
        console.error("[SeaRoute Error]:", err);
        if (gen !== genRef.current) return;
        setState((s) => ({ ...s, optimizing: false }));
      }
    },
    [],
  );

  const startRoute = useCallback(
    (from: LatLng, to: LatLng) => {
      if (!isFiniteLatLng(from) || !isFiniteLatLng(to)) {
        console.error("[SeaRoute Error]: startRoute rejected invalid coords", { from, to });
        return;
      }
      const speed = stateRef.current.speedKts || ROUTE_SPEED_OPTIONS_KTS[1];
      console.log("[RouteSession Start]:", {
        origin: from,
        destination: to,
        mode: "editing",
        speedKts: speed,
      });
      void recompute(from, to, [], speed, "editing");
    },
    [recompute],
  );

  const setSpeed = useCallback((kts: number) => {
    if (!Number.isFinite(kts) || kts <= 0) return;
    setState((s) => {
      const etaMinutes = etaMinutesForNm(s.distanceNm, kts);
      const legs = s.legs.map((leg) => ({
        ...leg,
        etaMinutes: etaMinutesForNm(leg.distanceNm, kts),
      }));
      return { ...s, speedKts: kts, etaMinutes, legs };
    });
  }, []);

  const moveWaypoint = useCallback(
    (index: number, latlng: LatLng) => {
      if (!isFiniteLatLng(latlng)) return;
      const s = stateRef.current;
      if (s.mode !== "editing" || !s.origin || !s.destination) return;
      const viaCount = s.vias.length;
      let origin = s.origin;
      let destination = s.destination;
      let vias = [...s.vias];
      if (index === 0) origin = latlng;
      else if (index === viaCount + 1) destination = latlng;
      else if (index >= 1 && index <= viaCount) vias[index - 1] = latlng;
      else return;
      void recompute(origin, destination, vias, s.speedKts, "editing");
    },
    [recompute],
  );

  const insertVia = useCallback(
    (afterLegIndex: number, latlng: LatLng) => {
      if (!isFiniteLatLng(latlng)) return;
      const s = stateRef.current;
      if (s.mode !== "editing" || !s.origin || !s.destination) return;
      const vias = [...s.vias];
      const insertAt = Math.max(0, Math.min(afterLegIndex, vias.length));
      vias.splice(insertAt, 0, latlng);
      void recompute(s.origin, s.destination, vias, s.speedKts, "editing");
    },
    [recompute],
  );

  const removeVia = useCallback(
    (viaIndex: number) => {
      const s = stateRef.current;
      if (s.mode !== "editing" || !s.origin || !s.destination) return;
      if (viaIndex < 0 || viaIndex >= s.vias.length) return;
      const vias = s.vias.filter((_, i) => i !== viaIndex);
      void recompute(s.origin, s.destination, vias, s.speedKts, "editing");
    },
    [recompute],
  );

  /** Remove pin by editable index (0 origin / last dest clears session). */
  const removePin = useCallback(
    (index: number) => {
      const s = stateRef.current;
      if (!s.origin || !s.destination) {
        setState(IDLE);
        return;
      }
      const last = s.vias.length + 1;
      if (index === 0 || index === last) {
        genRef.current += 1;
        setState(IDLE);
        return;
      }
      const viaIndex = index - 1;
      if (viaIndex < 0 || viaIndex >= s.vias.length) return;
      const vias = s.vias.filter((_, i) => i !== viaIndex);
      void recompute(s.origin, s.destination, vias, s.speedKts, "editing");
    },
    [recompute],
  );

  const addViaAt = useCallback(
    (latlng: LatLng) => {
      if (!isFiniteLatLng(latlng)) return;
      const s = stateRef.current;
      if (s.mode === "idle" || !s.origin || !s.destination) return;
      const vias = [...s.vias, latlng];
      void recompute(s.origin, s.destination, vias, s.speedKts, "editing");
    },
    [recompute],
  );

  const reset = useCallback(() => {
    genRef.current += 1;
    setState(IDLE);
  }, []);

  const lockActive = useCallback(() => {
    setState((s) => {
      if (s.mode === "idle" || s.waypoints.length < 2) return s;
      return { ...s, mode: "active" };
    });
  }, []);

  const unlockEdit = useCallback(() => {
    setState((s) => {
      if (s.mode !== "active") return s;
      return { ...s, mode: "editing" };
    });
  }, []);

  return {
    ...state,
    startRoute,
    setSpeed,
    moveWaypoint,
    insertVia,
    removeVia,
    removePin,
    addViaAt,
    reset,
    lockActive,
    unlockEdit,
  };
}

export type RouteSession = ReturnType<typeof useRouteSession>;
