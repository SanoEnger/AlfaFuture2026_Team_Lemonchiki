import { matchPath, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../../../../app/session";
import { data } from "../../../../shared/api/data";
import type { AssistantContext } from "../types";

export function useAssistantContext(enabled: boolean) {
  const { session } = useSession();
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const owner = session?.username || "";
  const allowed = enabled && session?.role === "CLIENT";
  const match = matchPath("/client/applications/:id", pathname);
  const applicationId =
    match?.params.id === "new" ? params.get("draft") : match?.params.id;
  const documents = pathname === "/client/documents";
  const productId = !applicationId ? params.get("product") : null;
  const applicationQuery = useQuery({
    queryKey: ["application", applicationId, owner],
    queryFn: () => data.application(applicationId!, owner),
    enabled: !!allowed && !!applicationId,
  });
  const listQuery = useQuery({
    queryKey: ["applications", owner],
    queryFn: () => data.applications(owner),
    enabled: !!allowed && documents,
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: data.products,
    enabled: !!allowed && !!productId,
  });
  const query = applicationId
    ? applicationQuery
    : documents
      ? listQuery
      : productId
        ? productsQuery
        : null;
  const contextKey = applicationId
    ? `${owner}:application:${applicationId}`
    : documents
      ? `${owner}:documents:${params.get("application") || "default"}`
      : productId
        ? `${owner}:product:${productId}`
        : `${owner}:general`;
  let context: AssistantContext = { type: "general", contextKey, owner };
  if (applicationId && applicationQuery.data?.owner === owner) {
    const a = applicationQuery.data;
    const type = a.latest_offer ? "offer" : "application";
    context = {
      type,
      contextKey: `${owner}:${type}:${a.id}`,
      owner,
      application: a,
    };
  } else if (documents) {
    const a =
      listQuery.data?.find((a) => a.id === params.get("application")) ||
      listQuery.data?.[0] ||
      null;
    context = {
      type: "documents",
      contextKey: `${owner}:documents:${a?.id || "none"}`,
      owner,
      application: a,
    };
  } else if (productId) {
    const product = productsQuery.data?.find((p) => p.id === productId);
    if (product) context = { type: "product", contextKey, owner, product };
  }
  const error = query?.error || null;
  return {
    context,
    isLoading: !!query?.isPending && !!allowed,
    error,
    refresh: () => query?.refetch(),
  };
}
