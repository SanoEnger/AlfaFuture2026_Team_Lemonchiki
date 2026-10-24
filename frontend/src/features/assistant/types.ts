import type { Application, Product } from "../../../shared/api/types";

interface ContextBase {
  contextKey: string;
  owner: string;
}
export type AssistantContext =
  | (ContextBase & { type: "general" })
  | (ContextBase & { type: "product"; product: Product })
  | (ContextBase & { type: "application" | "offer"; application: Application })
  | (ContextBase & { type: "documents"; application: Application | null });
export interface AssistantSource {
  label: string;
  to: string;
}
export interface AssistantAction {
  label: string;
  to: string;
}
export interface AssistantMessage {
  messageId: string;
  contextKey: string;
  role: "user" | "assistant";
  text: string;
  sources: AssistantSource[];
  actions: AssistantAction[];
  createdAt: string;
  status: "pending" | "success" | "error";
  prompt?: string;
}
export interface AssistantReply {
  text: string;
  sources: AssistantSource[];
  actions: AssistantAction[];
}
export interface AssistantService {
  respond: (
    context: AssistantContext,
    question: string,
    signal: AbortSignal,
  ) => Promise<AssistantReply>;
}
