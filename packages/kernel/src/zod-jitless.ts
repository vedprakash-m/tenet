// Imported first by main.ts: Zod decides per object schema, when the schema is built, whether to generate a parser for
// it, so this must run before any schema module is evaluated. A kernel call is one short process, and generating and
// compiling a parser per object schema costs it more than the generated parser saves (NFR-01).
import { z } from "zod";

z.config({ jitless: true });
