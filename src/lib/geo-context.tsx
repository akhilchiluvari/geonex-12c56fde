import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { CITIES, type City } from "./cities";

// Simulated geo-lock: pick a session city from sessionStorage so the user can
// switch locations from the navbar to demo geo anomalies. Defaults to Hyderabad.
interface GeoContextValue {
  city: City;
  setCity: (c: City) => void;
  cities: City[];
}

const GeoContext = createContext<GeoContextValue | undefined>(undefined);

const KEY = "geonex.session_city";

export function GeoProvider({ children }: { children: ReactNode }) {
  const [city, setCityState] = useState<City>(CITIES[0]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      const found = CITIES.find((c) => c.name === saved);
      if (found) setCityState(found);
    }
  }, []);

  const setCity = (c: City) => {
    setCityState(c);
    if (typeof window !== "undefined") sessionStorage.setItem(KEY, c.name);
  };

  return (
    <GeoContext.Provider value={{ city, setCity, cities: CITIES }}>{children}</GeoContext.Provider>
  );
}

export function useGeo() {
  const ctx = useContext(GeoContext);
  if (!ctx) throw new Error("useGeo must be used inside GeoProvider");
  return ctx;
}
