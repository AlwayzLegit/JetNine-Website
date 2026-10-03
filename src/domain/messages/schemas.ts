import { z } from "zod";
import { contactInquiryStatusEnum } from "@/db/schema/contact";

/**
 * Input shapes for the message operations: resend a failed delivery, mark
 * a thread read, handle or reopen a website inquiry. `*Input` is what the
 * op takes (and what a stored proposal is re-parsed with at approval
 * time); `*Body` is the API body, which leaves the ids to the path.
 */

const reason = z.string().trim().max(2000).optional().describe("One line for the approver: why you are doing this.");

/** The kinds of record a thread hangs off. Mirrors ThreadSubject in ./queries. */
export const THREAD_KINDS = ["quote", "trip", "member"] as const;
export type ThreadKind = (typeof THREAD_KINDS)[number];

export const MessageRetryInput = z.object({
  id: z.uuid(),
});
export type MessageRetryInput = z.infer<typeof MessageRetryInput>;

export const MarkThreadReadInput = z.object({
  kind: z.enum(THREAD_KINDS),
  id: z.uuid(),
});
export type MarkThreadReadInput = z.infer<typeof MarkThreadReadInput>;

export const InquiryStatusInput = z.object({
  id: z.uuid(),
  status: z.enum(contactInquiryStatusEnum.enumValues).describe("handled closes the inquiry; new reopens it."),
});
export type InquiryStatusInput = z.infer<typeof InquiryStatusInput>;

export const MessageRetryBody = z.object({ reason });
export const InquiryStatusBody = InquiryStatusInput.omit({ id: true });
