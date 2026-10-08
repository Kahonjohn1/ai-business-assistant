import type { AssistRequest } from "./types";

export interface AssistProvider {
  generate(input: AssistRequest): Promise<string>;
}
