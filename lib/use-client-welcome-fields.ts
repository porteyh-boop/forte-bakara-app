"use client";

import { useCallback, useRef, useState } from "react";
import {
  DEFAULT_CLIENT_WELCOME_MESSAGE,
  getDefaultWelcomeMessageForClientType,
  hydrateWelcomeMessageForEdit,
  normalizeWelcomeMessageForSave,
  type ClientType,
} from "./client-profile";

export function useClientWelcomeFields() {
  const [clientType, setClientTypeState] = useState<ClientType | "">("");
  const [welcomeMessage, setWelcomeMessageState] = useState(
    DEFAULT_CLIENT_WELCOME_MESSAGE
  );
  const welcomeTouchedRef = useRef(false);

  const setClientType = useCallback((nextType: ClientType | "") => {
    setClientTypeState(nextType);
    if (!welcomeTouchedRef.current && nextType) {
      setWelcomeMessageState(getDefaultWelcomeMessageForClientType(nextType));
    }
  }, []);

  const setWelcomeMessage = useCallback((message: string) => {
    welcomeTouchedRef.current = true;
    setWelcomeMessageState(message);
  }, []);

  const resetWelcomeToDefault = useCallback(() => {
    setWelcomeMessageState(
      getDefaultWelcomeMessageForClientType(clientType || null)
    );
    welcomeTouchedRef.current = false;
  }, [clientType]);

  const hydrateFromUser = useCallback(
    (user: {
      client_type: ClientType | null;
      welcome_message: string | null;
    }) => {
      const type = user.client_type ?? "";
      setClientTypeState(type);
      setWelcomeMessageState(
        hydrateWelcomeMessageForEdit(user.welcome_message, user.client_type)
      );
      welcomeTouchedRef.current = Boolean(user.welcome_message?.trim());
    },
    []
  );

  const resetForNewClient = useCallback(() => {
    setClientTypeState("");
    setWelcomeMessageState(DEFAULT_CLIENT_WELCOME_MESSAGE);
    welcomeTouchedRef.current = false;
  }, []);

  const getWelcomeMessageForSave = useCallback((): string | null => {
    return normalizeWelcomeMessageForSave(
      welcomeMessage,
      clientType || null
    );
  }, [welcomeMessage, clientType]);

  return {
    clientType,
    welcomeMessage,
    setClientType,
    setWelcomeMessage,
    resetWelcomeToDefault,
    hydrateFromUser,
    resetForNewClient,
    getWelcomeMessageForSave,
  };
}
