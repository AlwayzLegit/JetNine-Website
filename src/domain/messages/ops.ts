import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import { channelWords, messagePreview } from "@/domain/requests/ops";
import {
  loadInquiryForStatus,
  loadMessageForRetry,
  loadThreadForMarkRead,
  markThreadRead,
  retryMessageDelivery,
  setInquiryStatus,
  type InquiryStatusState,
  type MarkThreadReadState,
  type MessageRetryState,
} from "./commands";
import { InquiryStatusInput, MarkThreadReadInput, MessageRetryInput, type ThreadKind } from "./schemas";

/**
 * Operations on the Messages page. Resending a failed delivery always
 * reaches the client, so a supervised key's call is queued for a person;
 * marking a thread read and handling a website inquiry are desk-side.
 */

function threadWords(kind: ThreadKind): string {
  switch (kind) {
    case "quote":
      return "request";
    case "trip":
      return "trip";
    case "member":
      return "client";
  }
}

function detailPath(state: MessageRetryState): string {
  const { subjectType, subjectId } = state.message;
  return subjectType === "quote" ? `/admin/requests/${subjectId}` : `/admin/trips/${subjectId}`;
}

export const messageRetryOp = defineOp<MessageRetryInput, MessageRetryState>({
  id: "message.retry",
  scope: "desk",
  schema: MessageRetryInput,
  load: loadMessageForRetry,
  // A retry re-sends to the client, every time.
  risk: () => "client",
  summary: (_input, state) =>
    `Resend ${channelWords(state.message.channel)} to ${state.message.toAddress} on ${threadWords(state.message.subjectType)} ${state.subjectCode}`,
  preview: (_input, state) => messagePreview(state.message.toAddress, state.message.body),
  subject: (_input, state) => ({ type: state.message.subjectType, id: state.message.subjectId, code: state.subjectCode }),
  run: retryMessageDelivery,
  revalidate: (_input, state) => ["/admin/messages", detailPath(state)],
});

export const markThreadReadOp = defineOp<MarkThreadReadInput, MarkThreadReadState>({
  id: "message.markRead",
  scope: "desk",
  schema: MarkThreadReadInput,
  load: loadThreadForMarkRead,
  risk: () => null,
  summary: (input) => `Mark a ${threadWords(input.kind)} thread as read`,
  subject: (input) => ({ type: input.kind, id: input.id }),
  run: markThreadRead,
  // Only refresh the list when something will change, so opening a thread
  // that was already read does not re-render it.
  revalidate: (_input, state) => (state.unread > 0 ? ["/admin/messages"] : []),
});

export const inquiryStatusOp = defineOp<InquiryStatusInput, InquiryStatusState>({
  id: "inquiry.status",
  scope: "desk",
  schema: InquiryStatusInput,
  load: loadInquiryForStatus,
  risk: () => null,
  summary: (input) => (input.status === "handled" ? "Mark a website message as handled" : "Reopen a website message"),
  subject: (input) => ({ type: "contact_inquiry", id: input.id }),
  run: setInquiryStatus,
  revalidate: () => ["/admin/messages"],
});

export const MESSAGE_OPS: AnyOp[] = [messageRetryOp, markThreadReadOp, inquiryStatusOp];
