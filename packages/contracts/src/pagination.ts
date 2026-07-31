import { z } from "zod";

/** Runtime schema for bounded cursor pagination input. */
export const paginationInputSchema = z.strictObject({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

/** Runtime schema for pagination metadata returned by an API. */
export const paginationMetadataSchema = z.strictObject({
  nextCursor: z.string().min(1).nullable(),
  hasMore: z.boolean(),
});

/** Runtime schema for metadata returned with a paginated result. */
export const paginationResultMetadataSchema = paginationMetadataSchema;

/** Validated cursor pagination input. */
export type PaginationInput = z.infer<typeof paginationInputSchema>;
/** Pagination metadata returned alongside a result page. */
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
/** Metadata returned with a paginated result. */
export type PaginationResultMetadata = PaginationMetadata;
