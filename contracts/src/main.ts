import { oc, type ContractRouterClient } from "@orpc/contract";
import { z } from "zod";
import { ingestBatchSchema } from "./messages.js";

export * from "./desktop.js";
export type * from "./group.js";
export * from "./messages.js";

export const contract = {
  ingest: {
    batch: oc
      .route({ method: "POST", path: "/v1/ingest" })
      .input(ingestBatchSchema)
      .output(z.object({ accepted: z.number().int() })),
  },
};

export type Contract = typeof contract;
export type ApiClient = ContractRouterClient<Contract>;
