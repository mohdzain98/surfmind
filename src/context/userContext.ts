import { createContext, useContext } from "react";
import type { UserContextValue } from "../types";

const userContext = createContext<UserContextValue | undefined>(undefined);

const useUserContext = (): UserContextValue => {
  const value = useContext(userContext);
  if (!value) throw new Error("useUserContext must be used inside UserState");
  return value;
};

export { userContext, useUserContext };
