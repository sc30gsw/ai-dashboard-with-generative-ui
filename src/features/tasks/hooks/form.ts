import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

const { fieldContext, formContext } = createFormHookContexts();

export const { withForm } = createFormHook({
  fieldComponents: {},
  fieldContext,
  formComponents: {},
  formContext,
});
