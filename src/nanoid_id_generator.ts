import { nanoid } from "nanoid";
import { IdGenerator } from "./types.js";

export function nanoid_id_generator(): IdGenerator {
  return {
    generate: () => nanoid(),
  };
}
