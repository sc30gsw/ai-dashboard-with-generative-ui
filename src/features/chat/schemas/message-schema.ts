import { z } from "zod";

export const CreateMessageSchema = z.object({
  body: z.string().min(1, "Message is required").max(2000, "Message is too long"),
});
