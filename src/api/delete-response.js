export const readDeleteResponse = async (
  response,
  fallbackMessage = "Unable to delete resource."
) => {
  if (!response?.ok) {
    const payload = await response?.json?.().catch(() => null);
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      fallbackMessage;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return { deleted: true };
};
